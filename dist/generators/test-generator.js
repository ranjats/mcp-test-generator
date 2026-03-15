export function generateTestSuite(analysis, language, config) {
    const describes = [];
    // Generate tests for standalone functions
    for (const func of analysis.functions) {
        if (!func.isExported && !config.coverageTargets.functions)
            continue;
        const testCases = generateTestCasesForFunction(func, config);
        describes.push({
            name: func.name,
            testCases,
            nestedDescribes: [],
            beforeEach: null,
        });
    }
    // Generate tests for classes
    if (config.coverageTargets.classes) {
        for (const cls of analysis.classes) {
            const classDescribe = generateTestsForClass(cls, config);
            describes.push(classDescribe);
        }
    }
    // Generate import statements
    const imports = generateImportStatements(analysis, language, config);
    return {
        sourceFile: analysis.filePath,
        testFile: "",
        imports,
        beforeEach: null,
        afterEach: null,
        describes,
    };
}
function generateTestCasesForFunction(func, config) {
    const testCases = [];
    // Basic positive test case
    testCases.push({
        name: `should ${func.name} correctly with valid input`,
        description: `Tests ${func.name} with standard valid input`,
        type: "positive",
        arrangement: generateArrangement(func),
        action: generateAction(func),
        assertion: generateAssertion(func),
        isAsync: func.isAsync,
        targetFunction: func.name,
        targetClass: func.className,
        mockDependencies: [],
    });
    // Parameter-based tests
    if (func.parameters.length > 0) {
        // Test with each parameter having edge values
        for (const param of func.parameters) {
            if (config.coverageTargets.edgeCases) {
                testCases.push(...generateEdgeCaseTests(func, param));
            }
            if (config.coverageTargets.errorHandling) {
                testCases.push(...generateErrorHandlingTests(func, param));
            }
        }
    }
    // Test with no arguments if all params are optional
    if (func.parameters.every((p) => p.isOptional)) {
        testCases.push({
            name: `should handle ${func.name} called with no arguments`,
            description: `Tests ${func.name} with no arguments when all params are optional`,
            type: "edge_case",
            arrangement: "// No arrangement needed - testing with no arguments",
            action: func.isAsync
                ? `const result = await ${func.name}();`
                : `const result = ${func.name}();`,
            assertion: "expect(result).toBeDefined();",
            isAsync: func.isAsync,
            targetFunction: func.name,
            targetClass: func.className,
            mockDependencies: [],
        });
    }
    // Async-specific tests
    if (func.isAsync) {
        testCases.push({
            name: `should handle ${func.name} rejection/error`,
            description: `Tests that ${func.name} properly handles async errors`,
            type: "error_handling",
            arrangement: "// Setup to trigger error condition",
            action: `const promise = ${func.name}(${generateInvalidArgs(func)});`,
            assertion: `await expect(promise).rejects.toThrow();`,
            isAsync: true,
            targetFunction: func.name,
            targetClass: func.className,
            mockDependencies: [],
        });
    }
    // Return type specific tests
    if (func.returnType) {
        testCases.push(...generateReturnTypeTests(func));
    }
    return testCases;
}
function generateTestsForClass(cls, config) {
    const nestedDescribes = [];
    const classCases = [];
    // Constructor tests
    if (cls.constructorInfo) {
        classCases.push({
            name: "should create an instance",
            description: `Tests that ${cls.name} can be instantiated`,
            type: "positive",
            arrangement: generateConstructorArrangement(cls),
            action: `const instance = new ${cls.name}(${generateConstructorArgs(cls)});`,
            assertion: `expect(instance).toBeInstanceOf(${cls.name});`,
            isAsync: false,
            targetFunction: "constructor",
            targetClass: cls.name,
            mockDependencies: [],
        });
    }
    // Method tests
    for (const method of cls.methods) {
        if (method.name.startsWith("_") && method.name !== "__init__")
            continue;
        const methodDescribe = {
            name: method.name,
            testCases: generateTestCasesForFunction({ ...method, className: cls.name }, config),
            nestedDescribes: [],
            beforeEach: `const instance = new ${cls.name}(${generateConstructorArgs(cls)});`,
        };
        nestedDescribes.push(methodDescribe);
    }
    return {
        name: cls.name,
        testCases: classCases,
        nestedDescribes,
        beforeEach: null,
    };
}
function generateEdgeCaseTests(func, param) {
    const tests = [];
    const paramType = param.type?.toLowerCase() || "any";
    if (paramType.includes("string") ||
        paramType === "any" ||
        !param.type) {
        tests.push({
            name: `should handle ${func.name} with empty string for ${param.name}`,
            description: `Edge case: empty string for ${param.name}`,
            type: "edge_case",
            arrangement: generateArrangementWithOverride(func, param.name, '""'),
            action: generateActionWithOverride(func, param.name, '""'),
            assertion: "expect(result).toBeDefined();",
            isAsync: func.isAsync,
            targetFunction: func.name,
            targetClass: func.className,
            mockDependencies: [],
        });
    }
    if (paramType.includes("number") ||
        paramType === "any" ||
        !param.type) {
        tests.push({
            name: `should handle ${func.name} with zero for ${param.name}`,
            description: `Edge case: zero value for ${param.name}`,
            type: "boundary",
            arrangement: generateArrangementWithOverride(func, param.name, "0"),
            action: generateActionWithOverride(func, param.name, "0"),
            assertion: "expect(result).toBeDefined();",
            isAsync: func.isAsync,
            targetFunction: func.name,
            targetClass: func.className,
            mockDependencies: [],
        });
    }
    return tests;
}
function generateErrorHandlingTests(func, param) {
    const tests = [];
    tests.push({
        name: `should handle ${func.name} with null/undefined for ${param.name}`,
        description: `Error handling: null or undefined for ${param.name}`,
        type: "error_handling",
        arrangement: generateArrangementWithOverride(func, param.name, "null"),
        action: generateActionWithOverride(func, param.name, "null"),
        assertion: "expect(result).toBeDefined();",
        isAsync: func.isAsync,
        targetFunction: func.name,
        targetClass: func.className,
        mockDependencies: [],
    });
    return tests;
}
function generateReturnTypeTests(_func) {
    return [];
}
function generateArrangement(func) {
    const args = func.parameters.map((p) => p.defaultValue ?? "undefined").join(", ");
    return `// Arrange\nconst result = ${func.isAsync ? "await " : ""}${func.name}(${args});`;
}
function generateAction(func) {
    const args = func.parameters.map((p) => p.name + ": " + (p.defaultValue ?? "undefined")).join(", ");
    return func.isAsync ? `const result = await ${func.name}(${args});` : `const result = ${func.name}(${args});`;
}
function generateAssertion(_func) {
    return "expect(result).toBeDefined();";
}
function generateInvalidArgs(func) {
    return func.parameters.map((_p) => "undefined").join(", ");
}
function generateConstructorArrangement(_cls) {
    return "// Arrange";
}
function generateConstructorArgs(cls) {
    return (cls.constructorInfo?.parameters ?? []).map((p) => p.defaultValue ?? "undefined").join(", ");
}
function generateArrangementWithOverride(func, paramName, value) {
    const args = func.parameters.map((p) => (p.name === paramName ? value : p.defaultValue ?? "undefined")).join(", ");
    return `// Arrange with ${paramName}=${value}\nconst result = ${func.isAsync ? "await " : ""}${func.name}(${args});`;
}
function generateActionWithOverride(func, paramName, value) {
    const args = func.parameters.map((p) => (p.name === paramName ? value : p.defaultValue ?? "undefined")).join(", ");
    return func.isAsync ? `const result = await ${func.name}(${args});` : `const result = ${func.name}(${args});`;
}
function generateImportStatements(analysis, _language, _config) {
    const base = analysis.filePath.replace(/\.(ts|tsx|js|jsx)$/, "").split("/").pop() ?? "module";
    return ["import { } from './" + base + "';"];
}
//# sourceMappingURL=test-generator.js.map