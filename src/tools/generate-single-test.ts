import * as path from "path";
import {
  GenerationConfig,
  CoverageTargets,
  TestFramework,
  ProgrammingLanguage,
} from "../models/project-info.js";
import { analyzeFile } from "../analyzers/function-extractor.js";
import { generateTestSuite } from "../generators/test-generator.js";
import { renderTestSuiteToCode } from "../utils/test-suite-renderer.js";
import type { DescribeBlock } from "../models/test-case.js";
import {
  generateTestFilePath,
  writeTestFile,
} from "../utils/file-utils.js";

export type GenerateSingleTestArgs = {
  filePath: string;
  testFramework?: TestFramework | string;
  outputPath?: string;
};

const defaultCoverageTargets: CoverageTargets = {
  functions: true,
  classes: true,
  edgeCases: true,
  errorHandling: true,
};

function countTestsInDescribe(block: DescribeBlock): number {
  return (
    block.testCases.length +
    block.nestedDescribes.reduce((a, n) => a + countTestsInDescribe(n), 0)
  );
}

export async function handleGenerateSingleTest(
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const params = args as GenerateSingleTestArgs;
  const filePath = params.filePath;
  if (!filePath || typeof filePath !== "string") {
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: "filePath is required" }) },
      ],
    };
  }

  const projectPath = path.dirname(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const language: ProgrammingLanguage =
    [".ts", ".tsx"].includes(ext) ? "typescript"
    : [".js", ".jsx"].includes(ext) ? "javascript"
    : ext === ".py" ? "python"
    : ext === ".java" ? "java"
    : "typescript";
  const testFramework: TestFramework =
    (params.testFramework as TestFramework) ?? "jest";

  const config: GenerationConfig = {
    projectPath,
    testFramework,
    testStyle: "unit",
    overwrite: true,
    coverageTargets: defaultCoverageTargets,
  };

  const analysis = analyzeFile(filePath, language);
  const suite = generateTestSuite(analysis, language, config);
  const testCount = suite.describes.reduce(
    (acc, d) => acc + countTestsInDescribe(d),
    0
  );

  const relativePath = path.relative(projectPath, filePath);
  const testFilePath =
    params.outputPath ??
    generateTestFilePath(
      projectPath,
      relativePath,
      language,
      testFramework,
      undefined
    );
  const content = renderTestSuiteToCode(suite, testFramework, language);
  writeTestFile(testFilePath, content);

  const summary = {
    sourceFile: filePath,
    testFile: testFilePath,
    testCount,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
  };
}
