import { CoverageTargets, TestFramework } from "../models/project-info.js";
export type GenerateTestsArgs = {
    projectPath: string;
    testFramework?: TestFramework | string;
    outputDir?: string;
    testStyle?: "unit" | "integration" | "both";
    includePatterns?: string[];
    excludePatterns?: string[];
    overwrite?: boolean;
    coverageTargets?: Partial<CoverageTargets>;
};
export declare function handleGenerateTests(args: unknown): Promise<{
    content: Array<{
        type: "text";
        text: string;
    }>;
}>;
