export interface FunctionInfo {
    name: string;
    type: "function" | "method" | "arrow" | "constructor";
    isAsync: boolean;
    isExported: boolean;
    isStatic: boolean;
    parameters: ParameterInfo[];
    returnType: string | null;
    className: string | null;
    decorators: string[];
    jsDoc: string | null;
    complexity: number;
    startLine: number;
    endLine: number;
    body: string;
}
export interface ParameterInfo {
    name: string;
    type: string | null;
    isOptional: boolean;
    defaultValue: string | null;
    isRest: boolean;
}
export interface ClassInfo {
    name: string;
    isExported: boolean;
    constructorInfo: FunctionInfo | null;
    methods: FunctionInfo[];
    properties: PropertyInfo[];
    decorators: string[];
    extendsClass: string | null;
    implementsInterfaces: string[];
}
export interface PropertyInfo {
    name: string;
    type: string | null;
    isPrivate: boolean;
    isStatic: boolean;
    defaultValue: string | null;
}
export interface FileAnalysis {
    filePath: string;
    imports: ImportInfo[];
    exports: string[];
    functions: FunctionInfo[];
    classes: ClassInfo[];
    constants: ConstantInfo[];
    interfaces: InterfaceInfo[];
}
export interface ImportInfo {
    module: string;
    namedImports: string[];
    defaultImport: string | null;
    isTypeOnly: boolean;
}
export interface ConstantInfo {
    name: string;
    type: string | null;
    value: string | null;
    isExported: boolean;
}
export interface InterfaceInfo {
    name: string;
    properties: PropertyInfo[];
    isExported: boolean;
}
