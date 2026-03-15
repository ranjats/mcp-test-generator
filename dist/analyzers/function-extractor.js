import { analyzeTypeScriptFile } from "./typescript-analyzer.js";
import { analyzePythonFile } from "./python-analyzer.js";
export function analyzeFile(filePath, language) {
    switch (language) {
        case "typescript":
        case "javascript":
            return analyzeTypeScriptFile(filePath);
        case "python":
            return analyzePythonFile(filePath);
        case "java":
            // For Java, we'd use java-analyzer.ts
            // Simplified for now - returning basic structure
            return analyzeTypeScriptFile(filePath); // Simplified fallback
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}
//# sourceMappingURL=function-extractor.js.map