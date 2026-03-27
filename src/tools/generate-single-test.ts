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
import { runProjectTests } from "../utils/test-runner.js";
import {
  generateTestFilePath,
  writeTestFile,
} from "../utils/file-utils.js";

export type GenerateSingleTestArgs = {
  filePath: string;
  testFramework?: TestFramework | string;
  outputPath?: string;
  verify?: boolean;
  autoFix?: boolean;
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
    : ext === ".go" ? "go"
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
  suite.testFile = testFilePath;
  if (language === "java") {
    const firstClass = analysis.classes?.[0];
    (suite as any).__javaProperties = firstClass?.properties ?? [];
    (suite as any).__analysis = analysis;
  }
  const content = renderTestSuiteToCode(suite, testFramework, language);
  writeTestFile(testFilePath, content);

  const summary = {
    sourceFile: filePath,
    testFile: testFilePath,
    testCount,
    verify: null as null | {
      command: string;
      args: string[];
      exitCode: number;
      stdout: string;
      stderr: string;
      attemptedAutoFix: boolean;
    },
  };

  if (params.verify) {
    const initial = await runProjectTests({
      projectPath,
      language,
      testFramework: testFramework as TestFramework,
    });
    let attemptedAutoFix = false;
    let final = initial;
    if (initial.exitCode !== 0 && params.autoFix) {
      attemptedAutoFix = true;
      final = await runProjectTests({
        projectPath,
        language,
        testFramework: testFramework as TestFramework,
      });
    }
    summary.verify = {
      command: final.command,
      args: final.args,
      exitCode: final.exitCode,
      stdout: final.stdout,
      stderr: final.stderr,
      attemptedAutoFix,
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
  };
}
