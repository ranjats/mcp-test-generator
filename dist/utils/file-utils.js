import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { getSourceExtensions } from "./language-detector.js";
const DEFAULT_EXCLUDE_DIRS = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".next",
    "__pycache__",
    ".pytest_cache",
    "venv",
    "env",
    ".venv",
    "target",
    ".gradle",
    ".idea",
    ".vscode",
];
const DEFAULT_EXCLUDE_FILES = [
    "*.d.ts",
    "*.config.*",
    "*.spec.*",
    "*.test.*",
    "*_test.*",
    "*Test.*",
    "index.ts",
    "index.js",
    "main.ts",
    "main.js",
    "setup.*",
    "jest.setup.*",
];
export async function findSourceFiles(projectPath, language, includePatterns, excludePatterns) {
    const extensions = getSourceExtensions(language);
    let patterns;
    if (includePatterns && includePatterns.length > 0) {
        patterns = includePatterns;
    }
    else {
        patterns = extensions.map((ext) => `**/*${ext}`);
    }
    const excludeDirs = DEFAULT_EXCLUDE_DIRS.map((d) => `**/${d}/**`);
    const defaultExcludes = [
        ...excludeDirs,
        ...DEFAULT_EXCLUDE_FILES.map((f) => `**/${f}`),
    ];
    const allExcludes = [
        ...defaultExcludes,
        ...(excludePatterns || []),
    ];
    const sourceFiles = [];
    for (const pattern of patterns) {
        const files = await glob(pattern, {
            cwd: projectPath,
            ignore: allExcludes,
            absolute: false,
            nodir: true,
        });
        for (const file of files) {
            const absolutePath = path.join(projectPath, file);
            const stat = fs.statSync(absolutePath);
            // Skip test files
            if (isTestFile(file))
                continue;
            // Skip very small files (likely just exports)
            if (stat.size < 50)
                continue;
            const existingTestPath = findExistingTest(projectPath, file, language);
            sourceFiles.push({
                filePath: absolutePath,
                relativePath: file,
                language,
                size: stat.size,
                hasExistingTests: existingTestPath !== null,
                existingTestPath,
            });
        }
    }
    return sourceFiles;
}
export function isTestFile(filePath) {
    const basename = path.basename(filePath);
    return (basename.includes(".test.") ||
        basename.includes(".spec.") ||
        basename.includes("_test.") ||
        basename.endsWith("Test.java") ||
        basename.endsWith("Tests.java") ||
        filePath.includes("__tests__") ||
        filePath.includes("/tests/") ||
        filePath.includes("/test/"));
}
export function findExistingTest(projectPath, sourceRelativePath, language) {
    const parsed = path.parse(sourceRelativePath);
    const nameWithoutExt = parsed.name;
    const dir = parsed.dir;
    const possibleTestPaths = [
        // Co-located tests
        path.join(dir, `${nameWithoutExt}.test${parsed.ext}`),
        path.join(dir, `${nameWithoutExt}.spec${parsed.ext}`),
        // __tests__ directory
        path.join(dir, "__tests__", `${nameWithoutExt}.test${parsed.ext}`),
        path.join(dir, "__tests__", `${nameWithoutExt}.spec${parsed.ext}`),
        // tests directory at root
        path.join("tests", dir, `${nameWithoutExt}.test${parsed.ext}`),
        path.join("test", dir, `${nameWithoutExt}.test${parsed.ext}`),
    ];
    // Python-specific
    if (language === "python") {
        possibleTestPaths.push(path.join(dir, `test_${nameWithoutExt}.py`), path.join(dir, `${nameWithoutExt}_test.py`), path.join("tests", `test_${nameWithoutExt}.py`));
    }
    // Java-specific
    if (language === "java") {
        possibleTestPaths.push(path.join(dir.replace("main", "test"), `${nameWithoutExt}Test.java`));
    }
    for (const testPath of possibleTestPaths) {
        const absoluteTestPath = path.join(projectPath, testPath);
        if (fs.existsSync(absoluteTestPath)) {
            return testPath;
        }
    }
    return null;
}
export function generateTestFilePath(projectPath, sourceRelativePath, language, testFramework, outputDir) {
    const parsed = path.parse(sourceRelativePath);
    const nameWithoutExt = parsed.name;
    let testFileName;
    let testDir;
    switch (language) {
        case "python":
            testFileName = `test_${nameWithoutExt}.py`;
            testDir = outputDir || "tests";
            break;
        case "java":
            testFileName = `${nameWithoutExt}Test.java`;
            testDir = outputDir || parsed.dir.replace("src/main", "src/test");
            break;
        default:
            testFileName = `${nameWithoutExt}.test${parsed.ext}`;
            testDir = outputDir || path.join(parsed.dir, "__tests__");
            break;
    }
    return path.join(projectPath, testDir, testFileName);
}
export function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
export function writeTestFile(filePath, content) {
    ensureDirectoryExists(filePath);
    fs.writeFileSync(filePath, content, "utf-8");
}
//# sourceMappingURL=file-utils.js.map