import * as fs from "fs";
import * as path from "path";
export function parseProjectConfig(projectPath) {
    const config = {
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
        }
        catch {
            // Ignore parse errors
        }
    }
    return config;
}
//# sourceMappingURL=config-parser.js.map