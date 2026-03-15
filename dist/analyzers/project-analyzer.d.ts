import { ProjectInfo } from "../models/project-info.js";
export declare function analyzeProject(projectPath: string, includePatterns?: string[], excludePatterns?: string[]): Promise<ProjectInfo>;
