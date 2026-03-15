import { ProgrammingLanguage, SourceFileInfo } from "../models/project-info.js";
export declare function findSourceFiles(projectPath: string, language: ProgrammingLanguage, includePatterns?: string[], excludePatterns?: string[]): Promise<SourceFileInfo[]>;
export declare function isTestFile(filePath: string): boolean;
export declare function findExistingTest(projectPath: string, sourceRelativePath: string, language: ProgrammingLanguage): string | null;
export declare function generateTestFilePath(projectPath: string, sourceRelativePath: string, language: ProgrammingLanguage, testFramework: string, outputDir?: string): string;
export declare function ensureDirectoryExists(filePath: string): void;
export declare function writeTestFile(filePath: string, content: string): void;
