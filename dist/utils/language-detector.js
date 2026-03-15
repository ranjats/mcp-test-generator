import * as fs from "fs";
import * as path from "path";
export function detectLanguage(projectPath) {
    const files = fs.readdirSync(projectPath);
    // Check for TypeScript
    if (files.includes("tsconfig.json") ||
        files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
        return "typescript";
    }
    // Check for Python
    if (files.includes("setup.py") ||
        files.includes("pyproject.toml") ||
        files.includes("requirements.txt") ||
        files.some((f) => f.endsWith(".py"))) {
        return "python";
    }
    // Check for Java
    if (files.includes("pom.xml") ||
        files.includes("build.gradle") ||
        files.some((f) => f.endsWith(".java"))) {
        return "java";
    }
    // Check for JavaScript
    if (files.includes("package.json") ||
        files.some((f) => f.endsWith(".js") || f.endsWith(".jsx"))) {
        return "javascript";
    }
    return "unknown";
}
export function detectFramework(projectPath) {
    const packageJsonPath = path.join(projectPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
            const allDeps = {
                ...pkg.dependencies,
                ...pkg.devDependencies,
            };
            if (allDeps["next"])
                return "nextjs";
            if (allDeps["@nestjs/core"])
                return "nestjs";
            if (allDeps["react"])
                return "react";
            if (allDeps["vue"])
                return "vue";
            if (allDeps["@angular/core"])
                return "angular";
            if (allDeps["express"])
                return "express";
        }
        catch {
            // Ignore parse errors
        }
    }
    // Check for Python frameworks
    const requirementsPath = path.join(projectPath, "requirements.txt");
    if (fs.existsSync(requirementsPath)) {
        const content = fs.readFileSync(requirementsPath, "utf-8");
        if (content.includes("fastapi"))
            return "fastapi";
        if (content.includes("flask"))
            return "flask";
        if (content.includes("django"))
            return "django";
    }
    // Check for pyproject.toml
    const pyprojectPath = path.join(projectPath, "pyproject.toml");
    if (fs.existsSync(pyprojectPath)) {
        const content = fs.readFileSync(pyprojectPath, "utf-8");
        if (content.includes("fastapi"))
            return "fastapi";
        if (content.includes("flask"))
            return "flask";
        if (content.includes("django"))
            return "django";
    }
    // Check for Java frameworks
    const pomPath = path.join(projectPath, "pom.xml");
    if (fs.existsSync(pomPath)) {
        const content = fs.readFileSync(pomPath, "utf-8");
        if (content.includes("spring"))
            return "spring";
    }
    return null;
}
export function detectTestFramework(projectPath, language) {
    const packageJsonPath = path.join(projectPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
            const allDeps = {
                ...pkg.dependencies,
                ...pkg.devDependencies,
            };
            if (allDeps["vitest"])
                return "vitest";
            if (allDeps["jest"] || allDeps["@jest/core"])
                return "jest";
            if (allDeps["mocha"])
                return "mocha";
        }
        catch {
            // Ignore
        }
    }
    // Defaults by language
    switch (language) {
        case "typescript":
        case "javascript":
            return "jest";
        case "python":
            return "pytest";
        case "java":
            return "junit";
        default:
            return "jest";
    }
}
export function getSourceExtensions(language) {
    switch (language) {
        case "typescript":
            return [".ts", ".tsx"];
        case "javascript":
            return [".js", ".jsx", ".mjs"];
        case "python":
            return [".py"];
        case "java":
            return [".java"];
        default:
            return [".ts", ".js"];
    }
}
export function getTestFileExtension(language, framework) {
    switch (language) {
        case "typescript":
            return framework === "vitest" ? ".test.ts" : ".test.ts";
        case "javascript":
            return ".test.js";
        case "python":
            return "_test.py";
        case "java":
            return "Test.java";
        default:
            return ".test.ts";
    }
}
//# sourceMappingURL=language-detector.js.map