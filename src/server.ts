import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import { handleGenerateTests } from "./tools/generate-tests.js";
import { handleAnalyzeProject } from "./tools/analyze-project.js";
import { handleGenerateSingleTest } from "./tools/generate-single-test.js";

export function createMCPServer(): Server {
  const server = new Server(
    {
      name: "mcp-test-generator",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "generate_all_tests",
          description:
            "Analyzes the entire project and generates test case files for all testable source files. Supports TypeScript, JavaScript, Python, Java, and Go projects.",
          inputSchema: {
            type: "object" as const,
            properties: {
              projectPath: {
                type: "string",
                description: "Absolute path to the project root directory",
              },
              testFramework: {
                type: "string",
                enum: ["jest", "mocha", "pytest", "junit", "vitest", "go", "auto"],
                description:
                  "Test framework to use. Use 'auto' to detect from project config.",
                default: "auto",
              },
              outputDir: {
                type: "string",
                description:
                  "Output directory for test files (relative to project root). Defaults to '__tests__' or 'tests' based on convention.",
              },
              testStyle: {
                type: "string",
                enum: ["unit", "integration", "both"],
                description: "Type of tests to generate",
                default: "unit",
              },
              includePatterns: {
                type: "array",
                items: { type: "string" },
                description:
                  "Glob patterns for files to include (e.g., ['src/**/*.ts'])",
              },
              excludePatterns: {
                type: "array",
                items: { type: "string" },
                description:
                  "Glob patterns for files to exclude (e.g., ['**/*.d.ts'])",
              },
              overwrite: {
                type: "boolean",
                description: "Whether to overwrite existing test files",
                default: false,
              },
              verify: {
                type: "boolean",
                description: "Run the project's test runner after generating tests",
                default: false,
              },
              autoFix: {
                type: "boolean",
                description:
                  "If verify fails, attempt limited auto-fixes (mainly JS/TS import/path fixes) and retry once",
                default: false,
              },
              ensureDependencies: {
                type: "boolean",
                description:
                  "For Spring/Maven/Gradle projects, ensure required test dependencies exist before running tests",
                default: false,
              },
              coverageTargets: {
                type: "object",
                properties: {
                  functions: {
                    type: "boolean",
                    description: "Generate tests for all functions",
                    default: true,
                  },
                  classes: {
                    type: "boolean",
                    description: "Generate tests for all classes",
                    default: true,
                  },
                  edgeCases: {
                    type: "boolean",
                    description: "Include edge case tests",
                    default: true,
                  },
                  errorHandling: {
                    type: "boolean",
                    description: "Include error handling tests",
                    default: true,
                  },
                },
              },
            },
            required: ["projectPath"],
          },
        },
        {
          name: "analyze_project",
          description:
            "Analyzes a project and returns information about its structure, detected language, framework, and testable components without generating tests.",
          inputSchema: {
            type: "object" as const,
            properties: {
              projectPath: {
                type: "string",
                description: "Absolute path to the project root directory",
              },
            },
            required: ["projectPath"],
          },
        },
        {
          name: "generate_single_test",
          description:
            "Generates test cases for a single source file.",
          inputSchema: {
            type: "object" as const,
            properties: {
              filePath: {
                type: "string",
                description: "Absolute path to the source file",
              },
              testFramework: {
                type: "string",
                enum: ["jest", "mocha", "pytest", "junit", "vitest", "go"],
                description: "Test framework to use",
              },
              outputPath: {
                type: "string",
                description: "Output path for the test file",
              },
              verify: {
                type: "boolean",
                description: "Run the project's test runner after generating the test",
                default: false,
              },
              autoFix: {
                type: "boolean",
                description:
                  "If verify fails, attempt limited auto-fixes (mainly JS/TS import/path fixes) and retry once",
                default: false,
              },
            },
            required: ["filePath"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "generate_all_tests":
          return await handleGenerateTests(args);
        case "analyze_project":
          return await handleAnalyzeProject(args);
        case "generate_single_test":
          return await handleGenerateSingleTest(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}