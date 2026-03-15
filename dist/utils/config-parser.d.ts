export interface ProjectConfig {
    name: string;
    version: string;
    testCommand: string | null;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
}
export declare function parseProjectConfig(projectPath: string): ProjectConfig;
