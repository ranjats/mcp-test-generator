import { TestSuite, DescribeBlock, TestCase } from "../models/test-case.js";
import { ProgrammingLanguage } from "../models/project-info.js";

export function renderTestSuiteToCode(
  suite: TestSuite,
  _testFramework: string,
  language: ProgrammingLanguage
): string {
  if (language === "python") {
    return renderPython(suite);
  }
  return renderJestOrVitest(suite);
}

function renderJestOrVitest(suite: TestSuite): string {
  const lines: string[] = [...suite.imports, ""];
  for (const block of suite.describes) {
    lines.push(...renderDescribeBlock(block, 0));
  }
  return lines.join("\n");
}

function renderDescribeBlock(block: DescribeBlock, indent: number): string[] {
  const lines: string[] = [];
  const pad = "  ".repeat(indent);
  lines.push(`${pad}describe("${escapeStr(block.name)}", () => {`);
  if (block.beforeEach) {
    lines.push(`${pad}  beforeEach(() => {`);
    block.beforeEach.split("\n").forEach((l) => lines.push(`${pad}    ${l.trim()}`));
    lines.push(`${pad}  });`);
  }
  for (const tc of block.testCases) {
    const testFn = tc.isAsync ? "async () =>" : "() =>";
    lines.push(`${pad}  it("${escapeStr(tc.name)}", ${testFn} {`);
    if (tc.arrangement) {
      tc.arrangement.split("\n").forEach((l) => lines.push(`${pad}    ${l.trim()}`));
    }
    tc.action.split("\n").forEach((l) => lines.push(`${pad}    ${l.trim()}`));
    tc.assertion.split("\n").forEach((l) => lines.push(`${pad}    ${l.trim()}`));
    lines.push(`${pad}  });`);
  }
  for (const nested of block.nestedDescribes) {
    lines.push(...renderDescribeBlock(nested, indent + 1));
  }
  lines.push(`${pad}});`);
  return lines;
}

function renderPython(suite: TestSuite): string {
  const lines: string[] = [...suite.imports, ""];
  for (const block of suite.describes) {
    lines.push(`class Test${block.name.replace(/\W/g, "_")}:`);
    if (block.beforeEach) {
      lines.push("    def setUp(self):");
      block.beforeEach.split("\n").forEach((l) => lines.push(`        ${l.trim()}`));
    }
    for (const tc of block.testCases) {
      const methodName = tc.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      lines.push(`    def test_${methodName}(self):`);
      [tc.arrangement, tc.action, tc.assertion].forEach((s) => {
        if (s) s.split("\n").forEach((l) => lines.push(`        ${l.trim()}`));
      });
      lines.push("");
    }
  }
  return lines.join("\n");
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
