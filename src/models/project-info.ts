export interface ProjectInfo {
    rootPath: string;
    language: ProgrammingLanguage;
    framework: ProjectFramework | null;
    testFramework: TestFramework;
    sourceFiles: SourceFileInfo[];
    packageManager: string | null;
    configFiles: string[];
    report?: ProjectReport;
  }

  export interface ProjectReport {
    summary?: string;
    endpoints?: SpringEndpoint[];
    configKeys?: string[];
    buildTool?: "maven" | "gradle" | "unknown";
    detected?: Record<string, unknown>;
  }

  export interface SpringEndpoint {
    httpMethod: string;
    path: string;
    controllerClass: string;
    methodName: string;
    sourceFile: string;
  }
  
  export type ProgrammingLanguage =
    | "typescript"
    | "javascript"
    | "python"
    | "java"
  | "go"
    | "unknown";
  
  export type ProjectFramework =
    | "react"
    | "nextjs"
    | "express"
    | "nestjs"
    | "fastapi"
    | "flask"
    | "django"
    | "spring"
    | "vue"
    | "angular"
    | null;
  
  export type TestFramework =
    | "jest"
    | "mocha"
    | "vitest"
    | "pytest"
    | "junit"
  | "go"
    | "auto";
  
  export interface SourceFileInfo {
    filePath: string;
    relativePath: string;
    language: ProgrammingLanguage;
    size: number;
    hasExistingTests: boolean;
    existingTestPath: string | null;
  }
  
  export interface GenerationConfig {
    projectPath: string;
    testFramework: TestFramework;
    outputDir?: string;
    testStyle: "unit" | "integration" | "both";
    includePatterns?: string[];
    excludePatterns?: string[];
    overwrite: boolean;
    coverageTargets: CoverageTargets;
  }
  
  export interface CoverageTargets {
    functions: boolean;
    classes: boolean;
    edgeCases: boolean;
    errorHandling: boolean;
  }
  
  export interface GenerationResult {
    totalFiles: number;
    generatedFiles: number;
    skippedFiles: number;
    errors: GenerationError[];
    generatedTestFiles: GeneratedTestFile[];
  }
  
  export interface GeneratedTestFile {
    sourceFile: string;
    testFile: string;
    testCount: number;
    content: string;
  }
  
  export interface GenerationError {
    file: string;
    error: string;
  }