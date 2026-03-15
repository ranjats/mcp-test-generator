import { analyzeProject } from "../analyzers/project-analyzer.js";
export async function handleAnalyzeProject(args) {
    const { projectPath } = args;
    if (!projectPath || typeof projectPath !== "string") {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: "projectPath is required and must be a string" }),
                },
            ],
        };
    }
    const projectInfo = await analyzeProject(projectPath);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(projectInfo, null, 2),
            },
        ],
    };
}
//# sourceMappingURL=analyze-project.js.map