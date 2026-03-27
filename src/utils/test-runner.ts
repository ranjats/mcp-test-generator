import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { ProgrammingLanguage, TestFramework } from "../models/project-info.js";

export type TestRunResult = {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function runProjectTests(opts: {
  projectPath: string;
  language: ProgrammingLanguage;
  testFramework: TestFramework;
}): Promise<TestRunResult> {
  const { command, args, cwd } = pickTestCommand(opts);
  const res = await runCommand(command, args, cwd);
  return { command, args, exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr };
}

function pickTestCommand(opts: {
  projectPath: string;
  language: ProgrammingLanguage;
  testFramework: TestFramework;
}): { command: string; args: string[]; cwd: string } {
  const cwd = opts.projectPath;

  if (opts.language === "python") {
    return { command: "pytest", args: ["-q"], cwd };
  }

  if (opts.language === "go") {
    return { command: "go", args: ["test", "./..."], cwd };
  }

  if (opts.language === "java") {
    const pom = path.join(cwd, "pom.xml");
    const gradle = path.join(cwd, "build.gradle");
    const gradleKts = path.join(cwd, "build.gradle.kts");
    const gradlew = path.join(cwd, "gradlew");
    if (fs.existsSync(pom)) return { command: "mvn", args: ["test", "-q"], cwd };
    if (fs.existsSync(gradlew)) return { command: "./gradlew", args: ["test"], cwd };
    if (fs.existsSync(gradle) || fs.existsSync(gradleKts)) return { command: "gradle", args: ["test"], cwd };
    return { command: "mvn", args: ["test"], cwd };
  }

  // JS/TS
  if (opts.testFramework === "vitest") {
    return { command: "npx", args: ["-y", "vitest", "run"], cwd };
  }
  if (opts.testFramework === "jest") {
    return { command: "npx", args: ["-y", "jest"], cwd };
  }
  if (opts.testFramework === "mocha") {
    return { command: "npx", args: ["-y", "mocha"], cwd };
  }
  return { command: "npm", args: ["test"], cwd };
}

async function runCommand(command: string, args: string[], cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
    child.on("error", (err) => resolve({ exitCode: 1, stdout, stderr: stderr + String(err) }));
  });
}

