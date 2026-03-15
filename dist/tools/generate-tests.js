import * as path from "path";
import { analyzeProject } from "../analyzers/project-analyzer.js";
import { analyzeFile } from "../analyzers/function-extractor.js";
import { generateTestSuite } from "../generators/test-generator.js";
import { renderTestSuiteToCode } from "../utils/test-suite-renderer.js";
import { generateTestFilePath, writeTestFile, } from "../utils/file-utils.js";
const defaultCoverageTargets = {
    functions: true,
    classes: true,
    edgeCases: true,
    errorHandling: true,
};
function countTestsInDescribe(block) {
    return (block.testCases.length +
        block.nestedDescribes.reduce((a, n) => a + countTestsInDescribe(n), 0));
}
export async function handleGenerateTests(args) {
    const params = args;
    const projectPath = params.projectPath;
    if (!projectPath || typeof projectPath !== "string") {
        return {
            content: [
                { type: "text", text: JSON.stringify({ error: "projectPath is required" }) },
            ],
        };
    }
    const testFramework = params.testFramework === "auto" || !params.testFramework
        ? "auto"
        : params.testFramework;
    const config = {
        projectPath,
        testFramework,
        outputDir: params.outputDir,
        testStyle: params.testStyle ?? "unit",
        includePatterns: params.includePatterns,
        excludePatterns: params.excludePatterns,
        overwrite: params.overwrite ?? false,
        coverageTargets: { ...defaultCoverageTargets, ...params.coverageTargets },
    };
    const projectInfo = await analyzeProject(projectPath, config.includePatterns, config.excludePatterns);
    const framework = testFramework === "auto" ? projectInfo.testFramework : testFramework;
    const generated = [];
    const errors = [];
    for (const source of projectInfo.sourceFiles) {
        try {
            const analysis = analyzeFile(source.filePath, source.language);
            const suite = generateTestSuite(analysis, source.language, {
                ...config,
                testFramework: framework === "auto" ? "jest" : framework,
            });
            const testCount = suite.describes.reduce((acc, d) => acc + countTestsInDescribe(d), 0);
            if (testCount === 0)
                continue;
            const relativePath = path.relative(projectPath, source.filePath);
            const testFilePath = generateTestFilePath(projectPath, relativePath, source.language, framework === "auto" ? "jest" : framework, config.outputDir);
            if (!config.overwrite && source.hasExistingTests)
                continue;
            const content = renderTestSuiteToCode(suite, framework === "auto" ? "jest" : framework, source.language);
            writeTestFile(testFilePath, content);
            generated.push({
                sourceFile: source.filePath,
                testFile: testFilePath,
                testCount,
            });
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            errors.push({ file: source.filePath, error: message });
        }
    }
    const summary = {
        totalFiles: projectInfo.sourceFiles.length,
        generatedFiles: generated.length,
        skippedFiles: projectInfo.sourceFiles.length - generated.length - errors.length,
        errors,
        generatedTestFiles: generated,
    };
    return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
}
//# sourceMappingURL=generate-tests.js.map