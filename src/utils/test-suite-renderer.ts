import { TestSuite, DescribeBlock, TestCase } from "../models/test-case.js";
import { ProgrammingLanguage } from "../models/project-info.js";
import type { FileAnalysis, FunctionInfo, ParameterInfo } from "../models/function-info.js";

export function renderTestSuiteToCode(
  suite: TestSuite,
  _testFramework: string,
  language: ProgrammingLanguage
): string {
  if (language === "python") {
    return renderPython(suite);
  }
  if (language === "java") {
    return renderJUnit(suite);
  }
  if (language === "go") {
    return renderGoTest(suite);
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

function renderJUnit(suite: TestSuite): string {
  const lines: string[] = [];
  const pkg = inferJavaPackageFromTestPath(suite.testFile);
  const className = inferJavaTestClassNameFromPath(suite.testFile);
  const targetFqcn = inferJavaTargetFqcnFromSourcePath(suite.sourceFile);
  const targetSimple = targetFqcn ? targetFqcn.split(".").pop()! : "TargetClass";
  const injectName = lowerCamel(targetSimple);
  const analysis = (suite as any).__analysis as FileAnalysis | undefined;
  const methodsByName = indexJavaMethods(analysis);

  if (pkg) lines.push(`package ${pkg};`, "");

  lines.push("import org.junit.jupiter.api.BeforeEach;");
  lines.push("import org.junit.jupiter.api.Test;");
  lines.push("import org.junit.jupiter.api.extension.ExtendWith;");
  lines.push("import org.mockito.InjectMocks;");
  lines.push("import org.mockito.Mock;");
  lines.push("import org.mockito.junit.jupiter.MockitoExtension;");
  lines.push("import static org.junit.jupiter.api.Assertions.*;");
  lines.push("import static org.mockito.Mockito.*;");
  lines.push("import static org.mockito.ArgumentMatchers.*;");
  if (targetFqcn) lines.push(`import ${targetFqcn};`);
  lines.push("");

  lines.push("@ExtendWith(MockitoExtension.class)");
  lines.push(`public class ${className} {`);
  lines.push("");

  // Dependencies from Java analyzer fields (best-effort).
  const javaClass = suite.describes.find((d) => d.name)?.name;
  const depFields = (suite as any).__javaProperties as Array<{ type: string | null; name: string }> | undefined;
  if (depFields?.length) {
    for (const dep of depFields) {
      const type = dep.type?.trim();
      if (!type) continue;
      lines.push("  @Mock");
      lines.push(`  private ${type} ${dep.name};`);
      lines.push("");
    }
  }

  lines.push("  @InjectMocks");
  lines.push(`  private ${targetSimple} ${injectName};`);
  lines.push("");

  lines.push("  @BeforeEach");
  lines.push("  void setUp() {");
  lines.push("    // Add common dummy objects here if needed");
  lines.push("  }");
  lines.push("");

  for (const block of suite.describes) {
    for (const tc of flattenTestCases(block)) {
      const methodName = toJavaIdentifier(`test_${tc.targetClass ?? ""}_${tc.targetFunction ?? ""}_${tc.name}`);
      const targetMethod = tc.targetFunction ? methodsByName.get(tc.targetFunction) : undefined;
      const args = targetMethod ? buildJavaArgs(targetMethod.parameters, tc) : "";
      const actLine = targetMethod
        ? buildJavaActLine(injectName, targetMethod, args)
        : `// TODO: call method on ${injectName}`;

      lines.push("  @Test");
      lines.push(`  void ${methodName}() {`);
      lines.push("    // Arrange");
      const stubs =
        targetMethod && depFields?.length
          ? inferMockitoStubs(targetMethod.body, depFields.map((d) => d.name))
          : [];
      if (stubs.length) {
        for (const s of stubs) lines.push(`    ${s}`);
      } else {
        lines.push("    // TODO: setup mocks with when(...).thenReturn(...) if needed");
      }
      lines.push("");
      lines.push("    // Act");
      lines.push(`    ${actLine}`);
      lines.push("");
      lines.push("    // Assert");
      if (targetMethod) {
        if (isVoidJavaReturn(targetMethod.returnType)) {
          lines.push("    assertDoesNotThrow(() -> {");
          lines.push(`      ${actLine.replace(/^.*=\\s*/, "").replace(/;$/, "")};`);
          lines.push("    });");
          const verifies =
            depFields?.length
              ? inferMockitoVerifies(targetMethod.body, depFields.map((d) => d.name))
              : [];
          for (const v of verifies.slice(0, 3)) lines.push(`    ${v}`);
        } else {
          lines.push("    assertNotNull(result);");
        }
      } else {
        lines.push(`    assertNotNull(${injectName});`);
      }
      lines.push("  }");
      lines.push("");
    }
  }

  lines.push("}");
  return lines.join("\n");
}

function renderGoTest(suite: TestSuite): string {
  const lines: string[] = [];
  lines.push("package main");
  lines.push("");
  lines.push("import \"testing\"");
  lines.push("");

  for (const block of suite.describes) {
    const fnName = toGoIdentifier(`Test_${block.name}`);
    lines.push(`func ${fnName}(t *testing.T) {`);
    for (const tc of flattenTestCases(block)) {
      const caseName = escapeGoString(tc.name);
      lines.push(`  t.Run("${caseName}", func(t *testing.T) {`);
      lines.push("    // TODO: implement arrange/act/assert");
      lines.push("  })");
    }
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

function flattenTestCases(block: DescribeBlock): TestCase[] {
  return [
    ...block.testCases,
    ...block.nestedDescribes.flatMap((b) => flattenTestCases(b)),
  ];
}

function toJavaIdentifier(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
  const noLeading = cleaned.replace(/^[^a-zA-Z_]+/, "");
  return noLeading.length ? noLeading : "testGenerated";
}

function toGoIdentifier(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
  const noLeading = cleaned.replace(/^[^a-zA-Z_]+/, "");
  return noLeading.length ? noLeading : "TestGenerated";
}

function escapeGoString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function inferJavaTestClassNameFromPath(testFilePath: string | undefined): string {
  if (!testFilePath) return "GeneratedTests";
  const base = testFilePath.split(/[\\/]/).pop() ?? "GeneratedTests.java";
  return base.replace(/\.java$/i, "") || "GeneratedTests";
}

function inferJavaPackageFromTestPath(testFilePath: string | undefined): string | null {
  if (!testFilePath) return null;
  const norm = testFilePath.replace(/\\/g, "/");
  const marker = "/src/test/java/";
  const idx = norm.indexOf(marker);
  if (idx === -1) return null;
  const after = norm.slice(idx + marker.length);
  const dir = after.split("/").slice(0, -1).join("/");
  const pkg = dir.replace(/\//g, ".").trim();
  return pkg || null;
}

function inferJavaTargetFqcnFromSourcePath(sourceFilePath: string): string | null {
  const norm = sourceFilePath.replace(/\\/g, "/");
  const marker = "/src/main/java/";
  const idx = norm.indexOf(marker);
  if (idx === -1) return null;
  const after = norm.slice(idx + marker.length);
  const noExt = after.replace(/\.java$/i, "");
  return noExt.replace(/\//g, ".") || null;
}

function lowerCamel(s: string): string {
  if (!s) return "target";
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function indexJavaMethods(analysis?: FileAnalysis): Map<string, FunctionInfo> {
  const m = new Map<string, FunctionInfo>();
  const cls = analysis?.classes?.[0];
  if (!cls) return m;
  for (const fn of cls.methods ?? []) {
    if (fn.name) m.set(fn.name, fn);
  }
  return m;
}

function buildJavaArgs(params: ParameterInfo[], tc: TestCase): string {
  if (!params?.length) return "";
  const edge = tc.type === "edge_case" || /empty string|null|undefined|zero/i.test(tc.name);
  return params
    .map((p, idx) => {
      const t = (p.type ?? "").toLowerCase();
      const isFirst = idx === 0;
      if (edge && isFirst) {
        if (t.includes("string")) return "\"\"";
        if (t.includes("int") || t.includes("long") || t.includes("double") || t.includes("float") || t.includes("number")) return "0";
        return "null";
      }
      return defaultJavaValue(p.type);
    })
    .join(", ");
}

function defaultJavaValue(type: string | null): string {
  const t = (type ?? "").toLowerCase();
  if (!t) return "null";
  if (t.includes("string")) return "\"test\"";
  if (t === "int" || t === "integer") return "1";
  if (t === "long") return "1L";
  if (t === "double") return "1.0";
  if (t === "float") return "1.0f";
  if (t === "boolean" || t === "bool") return "true";
  if (t.includes("list") || t.includes("set")) return "java.util.Collections.emptyList()";
  if (t.includes("map")) return "java.util.Collections.emptyMap()";
  return "null";
}

function buildJavaActLine(instanceName: string, method: FunctionInfo, args: string): string {
  const call = `${instanceName}.${method.name}(${args})`;
  return isVoidJavaReturn(method.returnType) ? `${call};` : `var result = ${call};`;
}

function isVoidJavaReturn(ret: string | null): boolean {
  if (!ret) return false;
  return ret.trim() === "void";
}

function inferMockitoStubs(body: string, depNames: string[]): string[] {
  const calls = inferDependencyCalls(body, depNames);
  const stubs: string[] = [];
  for (const c of calls) {
    if (c.isVoidish) {
      stubs.push(`doNothing().when(${c.dep}).${c.method}(${c.argMatchers});`);
    } else {
      stubs.push(`when(${c.dep}.${c.method}(${c.argMatchers})).thenReturn(null);`);
    }
  }
  return uniq(stubs).slice(0, 8);
}

function inferMockitoVerifies(body: string, depNames: string[]): string[] {
  const calls = inferDependencyCalls(body, depNames);
  return uniq(
    calls.map((c) => `verify(${c.dep}, atLeastOnce()).${c.method}(${c.argMatchers});`)
  ).slice(0, 8);
}

function inferDependencyCalls(
  body: string,
  depNames: string[]
): Array<{ dep: string; method: string; argMatchers: string; isVoidish: boolean }> {
  const results: Array<{ dep: string; method: string; argMatchers: string; isVoidish: boolean }> = [];
  const lines = body.split("\\n");
  for (const dep of depNames) {
    const re = new RegExp(`\\\\b${escapeReg(dep)}\\\\.(\\\\w+)\\\\s*\\\\(([^)]*)\\\\)`, "g");
    for (const line of lines) {
      let match: RegExpExecArray | null;
      while ((match = re.exec(line)) !== null) {
        const method = match[1];
        const args = match[2]?.trim() ?? "";
        const argc = args ? args.split(",").length : 0;
        const argMatchers = argc === 0 ? "" : new Array(argc).fill("any()").join(", ");
        const isVoidish = !line.includes("=") && !line.includes("return") && line.trim().endsWith(");");
        results.push({ dep, method, argMatchers, isVoidish });
      }
    }
  }
  return results;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
}
