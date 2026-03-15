export type AnalyzeProjectArgs = {
    projectPath: string;
};
export declare function handleAnalyzeProject(args: unknown): Promise<{
    content: Array<{
        type: "text";
        text: string;
    }>;
}>;
