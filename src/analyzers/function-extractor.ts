import { FileAnalysis } from "../models/function-info.js";
import { ProgrammingLanguage } from "../models/project-info.js";
import { analyzeTypeScriptFile } from "./typescript-analyzer.js";
import { analyzePythonFile } from "./python-analyzer.js";
import { analyzeJavaFile } from "./java-analyzer.js";
import { analyzeGoFile } from "./go-analyzer.js";

export function analyzeFile(
  filePath: string,
  language: ProgrammingLanguage
): FileAnalysis {
  switch (language) {
    case "typescript":
    case "javascript":
      return analyzeTypeScriptFile(filePath);
    case "python":
      return analyzePythonFile(filePath);
    case "java":
      return analyzeJavaFile(filePath);
    case "go":
      return analyzeGoFile(filePath);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}