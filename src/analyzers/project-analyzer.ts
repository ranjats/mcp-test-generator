import * as fs from "fs";
import * as path from "path";
import { ProjectInfo, SourceFileInfo } from "../models/project-info.js";
import {
  detectLanguage,
  detectFramework,
  detectTestFramework,
} from "../utils/language-detector.js";
import { findSourceFiles } from "../utils/file-utils.js";

export async function analyzeProject(
  projectPath: string,
  includePatterns?: string[],
  excludePatterns?: string[]
): Promise<ProjectInfo> {
  // Validate project path
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }

  const language = detectLanguage(projectPath);
  const framework = detectFramework(projectPath);
  const testFramework = detectTestFramework(projectPath, language);

  const sourceFiles = await findSourceFiles(
    projectPath,
    language,
    includePatterns,
    excludePatterns
  );

  // Find config files
  const configFiles = findConfigFiles(projectPath);

  // Detect package manager
  const packageManager = detectPackageManager(projectPath);

  return {
    rootPath: projectPath,
    language,
    framework,
    testFramework,
    sourceFiles,
    packageManager,
    configFiles,
  };
}

function findConfigFiles(projectPath: string): string[] {
  const configFileNames = [
    "package.json",
    "tsconfig.json",
    "jest.config.js",
    "jest.config.ts",
    "vitest.config.ts",
    ".babelrc",
    "babel.config.js",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "pytest.ini",
    "pom.xml",
    "build.gradle",
  ];

  return configFileNames.filter((f) =>
    fs.existsSync(path.join(projectPath, f))
  );
}

function detectPackageManager(projectPath: string): string | null {
  if (fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectPath, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectPath, "package-lock.json"))) return "npm";
  if (fs.existsSync(path.join(projectPath, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(projectPath, "requirements.txt"))) return "pip";
  if (fs.existsSync(path.join(projectPath, "Pipfile"))) return "pipenv";
  if (fs.existsSync(path.join(projectPath, "poetry.lock"))) return "poetry";
  if (fs.existsSync(path.join(projectPath, "pom.xml"))) return "maven";
  if (fs.existsSync(path.join(projectPath, "build.gradle"))) return "gradle";
  return null;
}