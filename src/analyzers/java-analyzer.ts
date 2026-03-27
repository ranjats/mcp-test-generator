import * as fs from "fs";
import {
  FileAnalysis,
  FunctionInfo,
  ClassInfo,
  ParameterInfo,
  ImportInfo,
  ConstantInfo,
  InterfaceInfo,
  PropertyInfo,
} from "../models/function-info.js";

export function analyzeJavaFile(filePath: string): FileAnalysis {
  const content = fs.readFileSync(filePath, "utf-8");
  const imports = extractJavaImports(content);
  const classes = extractJavaClasses(content);

  return {
    filePath,
    imports,
    exports: classes.filter((c) => c.isExported).map((c) => c.name),
    functions: [], // Java functions are represented as class methods
    classes,
    constants: [] as ConstantInfo[],
    interfaces: [] as InterfaceInfo[],
  };
}

function extractJavaImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importRegex = /^\s*import\s+(static\s+)?([\w.]+)(?:\.\*)?\s*;\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      module: match[2],
      namedImports: [],
      defaultImport: null,
      isTypeOnly: false,
    });
  }
  return imports;
}

function extractJavaClasses(content: string): ClassInfo[] {
  const classes: ClassInfo[] = [];
  const classRegex =
    /^\s*(public\s+)?(abstract\s+)?(final\s+)?class\s+([A-Za-z_]\w*)\s*(?:extends\s+([A-Za-z_]\w*))?\s*(?:implements\s+([^{]+))?\s*\{/gm;

  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(content)) !== null) {
    const isPublic = Boolean(match[1]);
    const name = match[4];
    const extendsClass = match[5] ?? null;
    const implementsInterfaces =
      match[6]?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

    const classBody = sliceBlock(content, match.index);
    const methods = extractJavaMethods(classBody.block, name);
    const properties = extractJavaFields(classBody.block);

    classes.push({
      name,
      isExported: isPublic,
      constructorInfo: null,
      methods,
      properties,
      decorators: [],
      extendsClass,
      implementsInterfaces,
    });
  }

  return classes;
}

function extractJavaFields(classBlock: string): PropertyInfo[] {
  const props: PropertyInfo[] = [];
  // Very simple field matcher, excluding methods and static constants.
  // Examples:
  // private final UserRepository userRepository;
  // @Autowired private JwtUtils jwtUtils;
  const fieldRegex =
    /^\s*(?:@\w+(?:\([^)]*\))?\s*)*(public|protected|private)\s+(static\s+)?(final\s+)?([\w<>\[\]., ?]+)\s+([A-Za-z_]\w*)\s*(?:=\s*[^;]+)?\s*;\s*$/gm;

  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(classBlock)) !== null) {
    const isStatic = Boolean(match[2]);
    if (isStatic) continue;
    const type = (match[4] ?? "").trim() || null;
    const name = match[5];
    const isPrivate = match[1] === "private";

    props.push({
      name,
      type,
      isPrivate,
      isStatic: false,
      defaultValue: null,
    });
  }

  return props;
}

function extractJavaMethods(content: string, className: string): FunctionInfo[] {
  const methods: FunctionInfo[] = [];
  const methodRegex =
    /^\s*(public|protected|private)?\s*(static\s+)?(final\s+)?([\w<>\[\], ?]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:throws\s+[^ {]+(?:\s*,\s*[^ {]+)*)?\s*\{/gm;

  let match: RegExpExecArray | null;
  while ((match = methodRegex.exec(content)) !== null) {
    const visibility = match[1] ?? "";
    const isPublic = visibility === "public";
    const isStatic = Boolean(match[2]);
    const returnType = (match[4] ?? "").trim() || null;
    const name = match[5];
    const params = parseJavaParams(match[6]);

    const bodySlice = sliceBlock(content, match.index);
    const startLine = lineNumberAt(content, match.index);
    const endLine = lineNumberAt(content, bodySlice.endIndex);

    methods.push({
      name,
      type: name === className ? "constructor" : "method",
      isAsync: false,
      isExported: isPublic,
      isStatic,
      parameters: params,
      returnType: name === className ? null : returnType,
      className,
      decorators: [],
      jsDoc: null,
      complexity: 1,
      startLine,
      endLine,
      body: bodySlice.block,
    });
  }

  return methods;
}

function parseJavaParams(paramStr: string): ParameterInfo[] {
  const trimmed = paramStr.trim();
  if (!trimmed) return [];

  return trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // Example: "final List<String> items" or "@NotNull String name"
      const cleaned = p.replace(/@\w+(?:\([^)]*\))?\s*/g, "").replace(/\bfinal\s+/g, "");
      const parts = cleaned.trim().split(/\s+/);
      const name = parts.pop() ?? "arg";
      const type = parts.join(" ") || null;
      return {
        name,
        type,
        isOptional: false,
        defaultValue: null,
        isRest: cleaned.includes("..."),
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

