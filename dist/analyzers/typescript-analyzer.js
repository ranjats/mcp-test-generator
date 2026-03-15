import * as fs from "fs";
export function analyzeTypeScriptFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    return {
        filePath,
        imports: extractImports(content),
        exports: extractExports(content),
        functions: extractFunctions(content),
        classes: extractClasses(content),
        constants: extractConstants(content),
        interfaces: extractInterfaces(content),
    };
}
function extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(?:(type)\s+)?(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]/g;
    const importStarRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const isTypeOnly = match[1] === "type";
        const defaultImport = match[2] || null;
        const namedImportsStr = match[3] || "";
        const module = match[4];
        const namedImports = namedImportsStr
            ? namedImportsStr
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .map((s) => {
                // Handle "Name as Alias"
                const parts = s.split(/\s+as\s+/);
                return parts[parts.length - 1].trim();
            })
            : [];
        imports.push({ module, namedImports, defaultImport, isTypeOnly });
    }
    while ((match = importStarRegex.exec(content)) !== null) {
        imports.push({
            module: match[2],
            namedImports: [],
            defaultImport: match[1],
            isTypeOnly: false,
        });
    }
    return imports;
}
function extractExports(content) {
    const exports = [];
    const exportRegex = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
    const exportNamedRegex = /export\s*\{([^}]+)\}/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }
    while ((match = exportNamedRegex.exec(content)) !== null) {
        const names = match[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
        exports.push(...names);
    }
    return [...new Set(exports)];
}
function extractFunctions(content) {
    const functions = [];
    // Regular function declarations
    const funcRegex = /(?:(export)\s+)?(?:(default)\s+)?(?:(async)\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\n{]+))?\s*\{/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
        const isExported = !!match[1] || !!match[2];
        const isAsync = !!match[3];
        const name = match[4];
        const paramsStr = match[5];
        const returnType = match[6]?.trim() || null;
        const body = extractBody(content, match.index + match[0].length - 1);
        functions.push({
            name,
            type: "function",
            isAsync,
            isExported,
            isStatic: false,
            parameters: parseParameters(paramsStr),
            returnType,
            className: null,
            decorators: [],
            jsDoc: extractJsDoc(content, match.index),
            complexity: calculateComplexity(body),
            startLine: getLineNumber(content, match.index),
            endLine: getLineNumber(content, match.index + match[0].length + body.length),
            body,
        });
    }
    // Arrow functions assigned to const/let/var
    const arrowRegex = /(?:(export)\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:(async)\s+)?(?:\([^)]*\)|(\w+))\s*(?::\s*[^=]+)?\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
        const isExported = !!match[1];
        const name = match[2];
        const isAsync = !!match[3];
        // Find the arrow and extract parameters
        const preArrow = content.substring(match.index, content.indexOf("=>", match.index));
        const paramsMatch = preArrow.match(/\(([^)]*)\)/);
        const paramsStr = paramsMatch ? paramsMatch[1] : match[4] || "";
        const arrowIndex = content.indexOf("=>", match.index);
        const afterArrow = content.substring(arrowIndex + 2).trim();
        let body;
        if (afterArrow.startsWith("{")) {
            body = extractBody(content, arrowIndex + 2 + content.substring(arrowIndex + 2).indexOf("{"));
        }
        else {
            // Single expression
            const endIndex = findExpressionEnd(content, arrowIndex + 2);
            body = content.substring(arrowIndex + 2, endIndex).trim();
        }
        functions.push({
            name,
            type: "arrow",
            isAsync,
            isExported,
            isStatic: false,
            parameters: parseParameters(paramsStr),
            returnType: null,
            className: null,
            decorators: [],
            jsDoc: extractJsDoc(content, match.index),
            complexity: calculateComplexity(body),
            startLine: getLineNumber(content, match.index),
            endLine: getLineNumber(content, match.index + body.length),
            body,
        });
    }
    return functions;
}
function extractClasses(content) {
    const classes = [];
    const classRegex = /(?:(export)\s+)?(?:(default)\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
        const isExported = !!match[1];
        const name = match[3];
        const extendsClass = match[4] || null;
        const implementsStr = match[5]?.trim() || "";
        const implementsInterfaces = implementsStr
            ? implementsStr.split(",").map((s) => s.trim())
            : [];
        const classBody = extractBody(content, match.index + match[0].length - 1);
        const methods = extractMethods(classBody, name);
        const constructorInfo = methods.find((m) => m.type === "constructor") || null;
        const properties = extractClassProperties(classBody);
        classes.push({
            name,
            isExported,
            constructorInfo,
            methods: methods.filter((m) => m.type !== "constructor"),
            properties,
            decorators: extractDecorators(content, match.index),
            extendsClass,
            implementsInterfaces,
        });
    }
    return classes;
}
function extractMethods(classBody, className) {
    const methods = [];
    const methodRegex = /(?:(static)\s+)?(?:(async)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\n{]+))?\s*\{/g;
    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
        const isStatic = !!match[1];
        const isAsync = !!match[2];
        const name = match[3];
        const paramsStr = match[4];
        const returnType = match[5]?.trim() || null;
        if (name === "constructor") {
            methods.push({
                name: "constructor",
                type: "constructor",
                isAsync: false,
                isExported: false,
                isStatic: false,
                parameters: parseParameters(paramsStr),
                returnType: null,
                className,
                decorators: [],
                jsDoc: null,
                complexity: 1,
                startLine: 0,
                endLine: 0,
                body: "",
            });
        }
        else {
            const body = extractBody(classBody, match.index + match[0].length - 1);
            methods.push({
                name,
                type: "method",
                isAsync,
                isExported: false,
                isStatic,
                parameters: parseParameters(paramsStr),
                returnType,
                className,
                decorators: [],
                jsDoc: extractJsDoc(classBody, match.index),
                complexity: calculateComplexity(body),
                startLine: 0,
                endLine: 0,
                body,
            });
        }
    }
    return methods;
}
function parseParameters(paramsStr) {
    if (!paramsStr.trim())
        return [];
    const params = [];
    let depth = 0;
    let current = "";
    for (const char of paramsStr) {
        if (char === "(" || char === "<" || char === "{" || char === "[")
            depth++;
        if (char === ")" || char === ">" || char === "}" || char === "]")
            depth--;
        if (char === "," && depth === 0) {
            params.push(parseOneParameter(current.trim()));
            current = "";
        }
        else {
            current += char;
        }
    }
    if (current.trim()) {
        params.push(parseOneParameter(current.trim()));
    }
    return params;
}
function parseOneParameter(param) {
    const isRest = param.startsWith("...");
    if (isRest)
        param = param.substring(3);
    let defaultValue = null;
    const defaultMatch = param.match(/\s*=\s*(.+)$/);
    if (defaultMatch) {
        defaultValue = defaultMatch[1].trim();
        param = param.substring(0, param.indexOf("=")).trim();
    }
    const isOptional = param.includes("?");
    param = param.replace("?", "");
    let type = null;
    const typeMatch = param.match(/:\s*(.+)$/);
    if (typeMatch) {
        type = typeMatch[1].trim();
        param = param.substring(0, param.indexOf(":")).trim();
    }
    return {
        name: param.trim(),
        type,
        isOptional: isOptional || defaultValue !== null,
        defaultValue,
        isRest,
    };
}
function extractBody(content, openBraceIndex) {
    let depth = 0;
    let i = openBraceIndex;
    while (i < content.length) {
        if (content[i] === "{")
            depth++;
        if (content[i] === "}") {
            depth--;
            if (depth === 0) {
                return content.substring(openBraceIndex + 1, i);
            }
        }
        i++;
    }
    return content.substring(openBraceIndex + 1);
}
function findExpressionEnd(content, startIndex) {
    let i = startIndex;
    let depth = 0;
    while (i < content.length) {
        const char = content[i];
        if (char === "(" || char === "[" || char === "{")
            depth++;
        if (char === ")" || char === "]" || char === "}") {
            if (depth === 0)
                return i;
            depth--;
        }
        if ((char === ";" || char === "\n") && depth === 0)
            return i;
        i++;
    }
    return content.length;
}
function extractJsDoc(content, functionIndex) {
    const before = content.substring(0, functionIndex).trimEnd();
    const jsDocMatch = before.match(/\/\*\*[\s\S]*?\*\/\s*$/);
    return jsDocMatch ? jsDocMatch[0] : null;
}
function extractDecorators(content, classIndex) {
    const before = content.substring(0, classIndex).trimEnd();
    const decorators = [];
    const decoratorRegex = /@(\w+)(?:\([^)]*\))?\s*$/gm;
    let match;
    while ((match = decoratorRegex.exec(before)) !== null) {
        decorators.push(match[1]);
    }
    return decorators;
}
function extractClassProperties(classBody) {
    const properties = [];
    const propRegex = /(?:(private|protected|public)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?(\w+)(?:\?)?(?::\s*([^;=\n]+))?(?:\s*=\s*([^;\n]+))?;/g;
    let match;
    while ((match = propRegex.exec(classBody)) !== null) {
        const visibility = match[1] || "public";
        const name = match[4];
        if (["if", "else", "return", "const", "let", "var", "for", "while"].includes(name))
            continue;
        properties.push({
            name,
            type: match[5]?.trim() || null,
            isPrivate: visibility === "private",
            isStatic: !!match[2],
            defaultValue: match[6]?.trim() || null,
        });
    }
    return properties;
}
function extractConstants(content) {
    const constants = [];
    const constRegex = /(?:(export)\s+)?const\s+(\w+)(?::\s*([^=]+))?\s*=\s*([^;\n]+)/g;
    let match;
    while ((match = constRegex.exec(content)) !== null) {
        const name = match[2];
        // Skip if it's a function (arrow function)
        const value = match[4].trim();
        if (value.includes("=>") || value.startsWith("function"))
            continue;
        constants.push({
            name,
            type: match[3]?.trim() || null,
            value,
            isExported: !!match[1],
        });
    }
    return constants;
}
function extractInterfaces(content) {
    const interfaces = [];
    const interfaceRegex = /(?:(export)\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{/g;
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
        interfaces.push({
            name: match[2],
            properties: [],
            isExported: !!match[1],
        });
    }
    return interfaces;
}
function calculateComplexity(body) {
    let complexity = 1;
    const complexityKeywords = [
        /\bif\s*\(/g,
        /\belse\s+if\s*\(/g,
        /\bfor\s*\(/g,
        /\bwhile\s*\(/g,
        /\bswitch\s*\(/g,
        /\bcase\s+/g,
        /\bcatch\s*\(/g,
        /\?\?/g,
        /\?\./g,
        /&&/g,
        /\|\|/g,
        /\?[^.?]/g,
    ];
    for (const regex of complexityKeywords) {
        const matches = body.match(regex);
        if (matches)
            complexity += matches.length;
    }
    return complexity;
}
function getLineNumber(content, index) {
    return content.substring(0, index).split("\n").length;
}
//# sourceMappingURL=typescript-analyzer.js.map