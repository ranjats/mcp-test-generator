import { ProgrammingLanguage, ProjectFramework, TestFramework } from "../models/project-info.js";
export declare function detectLanguage(projectPath: string): ProgrammingLanguage;
export declare function detectFramework(projectPath: string): ProjectFramework;
export declare function detectTestFramework(projectPath: string, language: ProgrammingLanguage): TestFramework;
export declare function getSourceExtensions(language: ProgrammingLanguage): string[];
export declare function getTestFileExtension(language: ProgrammingLanguage, framework: TestFramework): string;
