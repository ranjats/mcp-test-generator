import * as fs from "fs";
import {
  FileAnalysis,
  FunctionInfo,
  ParameterInfo,
  ImportInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
} from "../models/function-info.js";

export function analyzeGoFile(filePath: string): FileAnalysis {
  const content = fs.readFileSync(filePath, "utf-8");
  return {
    filePath,
    imports: extractGoImports(content),
    exports: extractGoExports(content),
    functions: extractGoFunctions(content),
    classes: [] as ClassInfo[],
    constants: [] as ConstantInfo[],
    interfaces: [] as InterfaceInfo[],
  };
}

function extractGoImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // import "fmt"
  const single = /^\s*import\s+"([^"]+)"\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = single.exec(content)) !== null) {
    imports.push({ module: match[1], namedImports: [], defaultImport: null, isTypeOnly: false });
  }

  // import ( "fmt" alias "x/y" )
  const block = /^\s*import\s*\(([\s\S]*?)\)\s*$/gm;
  while ((match = block.exec(content)) !== null) {
    const lines = match[1].split("\n").map((l) => l.trim()).filter(Boolean);
    for (const l of lines) {
      const m = l.match(/^(?:\w+|\.)?\s*"([^"]+)"\s*$/);
      if (m) imports.push({ module: m[1], namedImports: [], defaultImport: null, isTypeOnly: false });
    }
  }

  return imports;
}

function extractGoExports(content: string): string[] {
  const exports: string[] = [];
  const funcRegex = /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1];
    if (name && /^[A-Z]/.test(name)) exports.push(name);
  }
  return exports;
}

function extractGoFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const funcRegex =
    /^\s*func\s+(?:\(([^)]*)\)\s*)?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(\([^)]*\)|[^{\n]+)?\s*\{/gm;

  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const receiver = (match[1] ?? "").trim();
    const name = match[2];
    const params = parseGoParams(match[3] ?? "");
    const returnType = (match[4] ?? "").trim() || null;
    const isExported = /^[A-Z]/.test(name);

    const bodySlice = sliceBlock(content, match.index);
    const startLine = lineNumberAt(content, match.index);
    const endLine = lineNumberAt(content, bodySlice.endIndex);

    functions.push({
      name,
      type: receiver ? "method" : "function",
      isAsync: false,
      isExported,
      isStatic: false,
      parameters: params,
      returnType,
      className: receiver ? receiver : null,
      decorators: [],
      jsDoc: null,
      complexity: 1,
      startLine,
      endLine,
      body: bodySlice.block,
    });
  }

  return functions;
}

function parseGoParams(paramStr: string): ParameterInfo[] {
  const trimmed = paramStr.trim();
  if (!trimmed) return [];

  return trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // Very simple: "ctx context.Context" or "name string" or "opts ...Option"
      const parts = p.split(/\s+/);
      const name = parts[0] ?? "arg";
      const type = parts.slice(1).join(" ") || null;
      return {
        name,
        type,
        isOptional: false,
        defaultValue: null,
        isRest: type?.startsWith("...") ?? false,
      };
    });
}

function sliceBlock(content: string, startIndex: number): { block: string; endIndex: number } {
  const open = content.indexOf("{", startIndex);
  if (open === -1) return { block: "", endIndex: startIndex };
  let depth = 0;
  for (let i = open; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) {
      return { block: content.slice(open, i + 1), endIndex: i + 1 };
    }
  }
  return { block: content.slice(open), endIndex: content.length };
}

function lineNumberAt(content: string, index: number): number {
  return content.substring(0, Math.max(0, index)).split("\n").length;
}

