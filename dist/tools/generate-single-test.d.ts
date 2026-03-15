import { TestFramework } from "../models/project-info.js";
export type GenerateSingleTestArgs = {
    filePath: string;
    testFramework?: TestFramework | string;
    outputPath?: string;
};
export declare function handleGenerateSingleTest(args: unknown): Promise<{
    content: Array<{
        type: "text";
        text: string;
    }>;
}>;
