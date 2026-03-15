export interface TestCase {
    name: string;
    description: string;
    type: TestCaseType;
    arrangement: string;
    action: string;
    assertion: string;
    isAsync: boolean;
    targetFunction: string;
    targetClass: string | null;
    mockDependencies: MockDependency[];
}
export type TestCaseType = "positive" | "negative" | "edge_case" | "error_handling" | "boundary" | "null_undefined" | "type_check";
export interface MockDependency {
    name: string;
    module: string;
    mockImplementation: string;
}
export interface TestSuite {
    sourceFile: string;
    testFile: string;
    imports: string[];
    beforeEach: string | null;
    afterEach: string | null;
    describes: DescribeBlock[];
}
export interface DescribeBlock {
    name: string;
    testCases: TestCase[];
    nestedDescribes: DescribeBlock[];
    beforeEach: string | null;
}
