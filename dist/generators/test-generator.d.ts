import { FileAnalysis } from "../models/function-info.js";
import { TestSuite } from "../models/test-case.js";
import { GenerationConfig, ProgrammingLanguage } from "../models/project-info.js";
export declare function generateTestSuite(analysis: FileAnalysis, language: ProgrammingLanguage, config: GenerationConfig): TestSuite;
