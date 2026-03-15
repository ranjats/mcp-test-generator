import * as fs from "fs";
import * as path from "path";

export interface ProjectConfig {
  name: string;
  version: string;
  testCommand: string | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export function parseProjectConfig(projectPath: string): ProjectConfig {
  const config: ProjectConfig = {
    name: "unknown",
    version: "0.0.0",
    testCommand: null,
    dependencies: {},
    devDependencies: {},
  };

  const packageJsonPath = path.join(projectPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      config.name = pkg.name || "unknown";
      config.version = pkg.version || "0.0.0";
      config.testCommand = pkg.scripts?.test || null;
      config.dependencies = pkg.dependencies || {};
      config.devDependencies = pkg.devDependencies || {};
    } catch {
      // Ignore parse errors
    }
  }

  return config;
}