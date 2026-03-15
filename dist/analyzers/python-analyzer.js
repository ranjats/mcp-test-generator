import * as fs from "fs";
export function analyzePythonFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    return {
        filePath,
        imports: extractPythonImports(content),
        exports: extractPythonExports(content),
        functions: extractPythonFunctions(content),
        classes: extractPythonClasses(content),
        constants: [],
        interfaces: [],
    };
}
function extractPythonImports(content) {
    const imports = [];
    // from x import y
    const fromImportRegex = /from\s+([\w.]+)\s+import\s+(.+)/g;
    let match;
    while ((match = fromImportRegex.exec(content)) !== null) {
        const namedImports = match[2]
            .split(",")
            .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
            .filter((s) => s.length > 0);
        imports.push({
            module: match[1],
            namedImports,
            defaultImport: null,
            isTypeOnly: false,
        });
    }
    // import x
    const importRegex = /^import\s+([\w.]+)(?:\s+as\s+(\w+))?/gm;
    while ((match = importRegex.exec(content)) !== null) {
        imports.push({
            module: match[1],
            namedImports: [],
            defaultImport: match[2] || match[1],
            isTypeOnly: false,
        });
    }
    return imports;
}
function extractPythonExports(content) {
    // Python doesn't have explicit exports, but we look for __all__
    const allMatch = content.match(/__all__\s*=\s*\[([^\]]+)\]/);
    if (allMatch) {
        return allMatch[1]
            .split(",")
            .map((s) => s.trim().replace(/['"]/g, ""))
            .filter((s) => s.length > 0);
    }
    // Return all top-level functions and classes (non-private)
    const exports = [];
    const funcRegex = /^(?:async\s+)?def\s+(\w+)/gm;
    const classRegex = /^class\s+(\w+)/gm;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
        if (!match[1].startsWith("_"))
            exports.push(match[1]);
    }
    while ((match = classRegex.exec(content)) !== null) {
        if (!match[1].startsWith("_"))
            exports.push(match[1]);
    }
    return exports;
}
function extractPythonFunctions(content) {
    const functions = [];
    const funcRegex = /^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^\n:]+))?\s*:/gm;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
        const isAsync = !!match[1];
        const name = match[2];
        const paramsStr = match[3];
        const returnType = match[4]?.trim() || null;
        // Extract docstring
        const afterDef = content.substring(match.index + match[0].length);
        const docstringMatch = afterDef.match(/^\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
        const jsDoc = docstringMatch
            ? docstringMatch[1] || docstringMatch[2]
            : null;
        // Extract body by indentation
        const body = extractPythonBody(content, match.index + match[0].length);
        // Extract decorators
        const decorators = extractPythonDecorators(content, match.index);
        functions.push({
            name,
            type: "function",
            isAsync,
            isExported: !name.startsWith("_"),
            isStatic: false,
            parameters: parsePythonParameters(paramsStr),
            returnType,
            className: null,
            decorators,
            jsDoc,
            complexity: calculatePythonComplexity(body),
            startLine: getLineNumber(content, match.index),
            endLine: getLineNumber(content, match.index + match[0].length + body.length),
            body,
        });
    }
    return functions;
}
function extractPythonClasses(content) {
    const classes = [];
    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?\s*:/gm;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
        const name = match[1];
        const parentStr = match[2] || "";
        const parents = parentStr
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        const classBody = extractPythonBody(content, match.index + match[0].length);
        // Extract methods from class body
        const methods = extractMethodsFromPythonClass(classBody, name);
        const constructorInfo = methods.find((m) => m.name === "__init__") || null;
        classes.push({
            name,
            isExported: !name.startsWith("_"),
            constructorInfo,
            methods: methods.filter((m) => m.name !== "__init__"),
            properties: [],
            decorators: extractPythonDecorators(content, match.index),
            extendsClass: parents.length > 0 ? parents[0] : null,
            implementsInterfaces: [],
        });
    }
    return classes;
}
function extractMethodsFromPythonClass(classBody, className) {
    const methods = [];
    const methodRegex = /(?:^|\n)\s+(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^\n:]+))?\s*:/g;
    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
        const isAsync = !!match[1];
        const name = match[2];
        const paramsStr = match[3];
        const returnType = match[4]?.trim() || null;
        const decorators = extractPythonDecorators(classBody, match.index);
        const isStatic = decorators.includes("staticmethod");
        methods.push({
            name,
            type: name === "__init__" ? "constructor" : "method",
            isAsync,
            isExported: !name.startsWith("_") || name === "__init__",
            isStatic,
            parameters: parsePythonParameters(paramsStr).filter((p) => p.name !== "self" && p.name !== "cls"),
            returnType,
            className,
            decorators,
            jsDoc: null,
            complexity: 1,
            startLine: 0,
            endLine: 0,
            body: "",
        });
    }
    return methods;
}
function parsePythonParameters(paramsStr) {
    if (!paramsStr.trim())
        return [];
    return paramsStr
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p !== "self" && p !== "cls")
        .map((p) => {
        let defaultValue = null;
        const defaultMatch = p.match(/\s*=\s*(.+)$/);
        if (defaultMatch) {
            defaultValue = defaultMatch[1].trim();
            p = p.substring(0, p.indexOf("=")).trim();
        }
        let type = null;
        const typeMatch = p.match(/:\s*(.+)$/);
        if (typeMatch) {
            type = typeMatch[1].trim();
            p = p.substring(0, p.indexOf(":")).trim();
        }
        const isRest = p.startsWith("*") || p.startsWith("**");
        if (isRest)
            p = p.replace(/^\*+/, "");
        return {
            name: p,
            type,
            isOptional: defaultValue !== null,
            defaultValue,
            isRest,
        };
    });
}
function extractPythonBody(content, startIndex) {
    const lines = content.substring(startIndex).split("\n");
    if (lines.length === 0)
        return "";
    // Find the indentation level of the first non-empty line
    let baseIndent = -1;
    const bodyLines = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().length === 0) {
            bodyLines.push("");
            continue;
        }
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        if (baseIndent === -1) {
            baseIndent = indent;
        }
        if (indent >= baseIndent) {
            bodyLines.push(line);
        }
        else {
            break;
        }
    }
    return bodyLines.join("\n");
}
function extractPythonDecorators(content, defIndex) {
    const before = content.substring(0, defIndex).trimEnd();
    const lines = before.split("\n").reverse();
    const decorators = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("@")) {
            const decoratorName = trimmed.match(/@(\w+)/)?.[1];
            if (decoratorName)
                decorators.push(decoratorName);
        }
        else if (trimmed.length > 0) {
            break;
        }
    }
    return decorators.reverse();
}
function calculatePythonComplexity(body) {
    let complexity = 1;
    const keywords = [
        /\bif\b/g,
        /\belif\b/g,
        /\bfor\b/g,
        /\bwhile\b/g,
        /\bexcept\b/g,
        /\band\b/g,
        /\bor\b/g,
    ];
    for (const regex of keywords) {
        const matches = body.match(regex);
        if (matches)
            complexity += matches.length;
    }
    return complexity;
}
function getLineNumber(content, index) {
    return content.substring(0, index).split("\n").length;
}
//# sourceMappingURL=python-analyzer.js.map