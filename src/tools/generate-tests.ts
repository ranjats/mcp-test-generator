import * as path from "path";
import {
  GenerationConfig,
  CoverageTargets,
  TestFramework,
  ProgrammingLanguage,
} from "../models/project-info.js";
import { analyzeProject } from "../analyzers/project-analyzer.js";
import { analyzeFile } from "../analyzers/function-extractor.js";
import { generateTestSuite } from "../generators/test-generator.js";
import { renderTestSuiteToCode } from "../utils/test-suite-renderer.js";
import type { DescribeBlock } from "../models/test-case.js";
import { runProjectTests } from "../utils/test-runner.js";
import { detectBuildTool } from "../analyzers/spring-analyzer.js";
import {
  generateTestFilePath,
  writeTestFile,
} from "../utils/file-utils.js";
import * as fs from "fs";
import * as pathFs from "path";

export type GenerateTestsArgs = {
  projectPath: string;
  testFramework?: TestFramework | string;
  outputDir?: string;
  testStyle?: "unit" | "integration" | "both";
  includePatterns?: string[];
  excludePatterns?: string[];
  overwrite?: boolean;
  verify?: boolean;
  autoFix?: boolean;
  ensureDependencies?: boolean;
  coverageTargets?: Partial<CoverageTargets>;
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

export async function handleGenerateTests(
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const params = args as GenerateTestsArgs;
  const projectPath = params.projectPath;
  if (!projectPath || typeof projectPath !== "string") {
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: "projectPath is required" }) },
      ],
    };
  }

  const testFramework: TestFramework =
    (params.testFramework as TestFramework) === "auto" || !params.testFramework
      ? "auto"
      : (params.testFramework as TestFramework);
  const config: GenerationConfig = {
    projectPath,
    testFramework,
    outputDir: params.outputDir,
    testStyle: params.testStyle ?? "unit",
    includePatterns: params.includePatterns,
    excludePatterns: params.excludePatterns,
    overwrite: params.overwrite ?? false,
    coverageTargets: { ...defaultCoverageTargets, ...params.coverageTargets },
  };

  const projectInfo = await analyzeProject(
    projectPath,
    config.includePatterns,
    config.excludePatterns
  );
  const framework =
    testFramework === "auto" ? projectInfo.testFramework : testFramework;
  const generated: Array<{ sourceFile: string; testFile: string; testCount: number }> = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const source of projectInfo.sourceFiles) {
    try {
      const analysis = analyzeFile(source.filePath, source.language);
      const suite = generateTestSuite(analysis, source.language, {
        ...config,
        testFramework: framework === "auto" ? "jest" : framework,
      });
      const testCount = suite.describes.reduce(
        (acc, d) => acc + countTestsInDescribe(d),
        0
      );
      if (testCount === 0) continue;
      const relativePath = path.relative(projectPath, source.filePath);
      const testFilePath = generateTestFilePath(
        projectPath,
        relativePath,
        source.language,
        framework === "auto" ? "jest" : framework,
        config.outputDir
      );
      if (!config.overwrite && source.hasExistingTests) continue;
      suite.testFile = testFilePath;

      // Attach Java dependency fields for Mockito mocks (best-effort).
      if (source.language === "java") {
        const firstClass = analysis.classes?.[0];
        (suite as any).__javaProperties = firstClass?.properties ?? [];
        (suite as any).__analysis = analysis;
      }

      // Limited auto-fix: generate correct JS/TS import path + named exports.
      if (source.language === "typescript" || source.language === "javascript") {
        const relImport = toPosixPath(
          "./" +
            path
              .relative(path.dirname(testFilePath), source.filePath)
              .replace(/\.(ts|tsx|js|jsx|mjs)$/, "")
        );
        const named = (analysis.exports ?? []).filter(Boolean);
        suite.imports =
          named.length > 0
            ? [`import { ${named.join(", ")} } from "${relImport}";`]
            : [`import * as target from "${relImport}";`];
      }

      const content = renderTestSuiteToCode(
        suite,
        framework === "auto" ? "jest" : framework,
        source.language
      );
      writeTestFile(testFilePath, content);
      generated.push({
        sourceFile: source.filePath,
        testFile: testFilePath,
        testCount,
      });
    } catch (e) {
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
    verify: null as null | {
      command: string;
      args: string[];
      exitCode: number;
      stdout: string;
      stderr: string;
      attemptedAutoFix: boolean;
    },
  };

  if (params.ensureDependencies && projectInfo.framework === "spring" && projectInfo.language === "java") {
    ensureSpringTestDeps(projectPath, detectBuildTool(projectPath));
  }

  if (params.verify) {
    const initial = await runProjectTests({
      projectPath,
      language: projectInfo.language,
      testFramework: (framework === "auto" ? projectInfo.testFramework : framework) as TestFramework,
    });

    let attemptedAutoFix = false;
    let final = initial;

    // Limited auto-fix (B): only re-run after our JS/TS import-path fix pass above.
    if (initial.exitCode !== 0 && params.autoFix) {
      attemptedAutoFix = true;
      final = await runProjectTests({
        projectPath,
        language: projectInfo.language,
        testFramework: (framework === "auto" ? projectInfo.testFramework : framework) as TestFramework,
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

function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

function ensureSpringTestDeps(projectPath: string, buildTool: "maven" | "gradle" | "unknown"): void {
  if (buildTool === "maven") {
    const pomPath = pathFs.join(projectPath, "pom.xml");
    if (!fs.existsSync(pomPath)) return;
    const pom = fs.readFileSync(pomPath, "utf-8");
    if (pom.includes("spring-boot-starter-test")) return;
    const depBlock =
      "\n    <dependency>\n      <groupId>org.springframework.boot</groupId>\n      <artifactId>spring-boot-starter-test</artifactId>\n      <scope>test</scope>\n    </dependency>\n";
    const updated = pom.includes("</dependencies>")
      ? pom.replace("</dependencies>", depBlock + "  </dependencies>")
      : pom.replace("</project>", "  <dependencies>" + depBlock + "  </dependencies>\n</project>");
    fs.writeFileSync(pomPath, updated, "utf-8");
    return;
  }

  if (buildTool === "gradle") {
    const gradlePath = fs.existsSync(pathFs.join(projectPath, "build.gradle.kts"))
      ? pathFs.join(projectPath, "build.gradle.kts")
      : pathFs.join(projectPath, "build.gradle");
    if (!fs.existsSync(gradlePath)) return;
    const txt = fs.readFileSync(gradlePath, "utf-8");
    if (txt.includes("spring-boot-starter-test")) return;
    const depLine = gradlePath.endsWith(".kts")
      ? "\n    testImplementation(\"org.springframework.boot:spring-boot-starter-test\")\n"
      : "\n    testImplementation 'org.springframework.boot:spring-boot-starter-test'\n";
    const updated = txt.includes("dependencies {")
      ? txt.replace(/dependencies\s*\{/, (m) => m + depLine)
      : txt + "\n\ndependencies {" + depLine + "}\n";
    fs.writeFileSync(gradlePath, updated, "utf-8");
  }
}
