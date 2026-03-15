import { analyzeProject } from "../analyzers/project-analyzer.js";

export type AnalyzeProjectArgs = {
  projectPath: string;
};

export async function handleAnalyzeProject(
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const { projectPath } = args as AnalyzeProjectArgs;
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
