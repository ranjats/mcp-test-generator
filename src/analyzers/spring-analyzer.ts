import * as fs from "fs";
import * as path from "path";
import { SpringEndpoint } from "../models/project-info.js";

export function detectBuildTool(projectPath: string): "maven" | "gradle" | "unknown" {
  if (fs.existsSync(path.join(projectPath, "pom.xml"))) return "maven";
  if (fs.existsSync(path.join(projectPath, "gradlew"))) return "gradle";
  if (fs.existsSync(path.join(projectPath, "build.gradle")) || fs.existsSync(path.join(projectPath, "build.gradle.kts"))) return "gradle";
  return "unknown";
}

export function extractSpringConfigKeys(projectPath: string): string[] {
  const candidates = [
    path.join(projectPath, "src", "main", "resources", "application.properties"),
    path.join(projectPath, "src", "main", "resources", "application.yml"),
    path.join(projectPath, "src", "main", "resources", "application.yaml"),
  ];

  const keys = new Set<string>();
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, "utf-8");
    if (p.endsWith(".properties")) {
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const idx = t.indexOf("=");
        if (idx > 0) keys.add(t.slice(0, idx).trim());
      }
    } else {
      // Very light YAML “key path” extraction (best-effort, not a full YAML parser)
      const stack: Array<{ indent: number; key: string }> = [];
      for (const raw of content.split("\n")) {
        const line = raw.replace(/\t/g, "  ");
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const indent = line.match(/^\s*/)?.[0].length ?? 0;
        const m = line.trim().match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
        if (!m) continue;
        const key = m[1];
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
        const full = [...stack.map((s) => s.key), key].join(".");
        keys.add(full);
        const hasValue = m[2] && m[2].trim().length > 0;
        if (!hasValue) stack.push({ indent, key });
      }
    }
  }

  return Array.from(keys).sort();
}

export function extractSpringEndpoints(projectPath: string): SpringEndpoint[] {
  const srcRoot = path.join(projectPath, "src", "main", "java");
  if (!fs.existsSync(srcRoot)) return [];

  const endpoints: SpringEndpoint[] = [];
  const javaFiles = walk(srcRoot).filter((f) => f.endsWith(".java"));

  for (const file of javaFiles) {
    const content = fs.readFileSync(file, "utf-8");
    if (!/@RestController\b|@Controller\b/.test(content)) continue;

    const className = extractJavaClassName(content) ?? path.basename(file, ".java");
    const base = extractClassBasePath(content) ?? "";

    // Method-level mappings
    const mappingRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(\(([\s\S]*?)\))?/g;
    let match: RegExpExecArray | null;
    while ((match = mappingRegex.exec(content)) !== null) {
      const ann = match[1];
      const args = match[3] ?? "";
      const methodName = extractNextJavaMethodName(content, mappingRegex.lastIndex) ?? "unknownMethod";
      const httpMethod = inferHttpMethod(ann, args);
      const p = inferPath(args);
      endpoints.push({
        httpMethod,
        path: normalizePath(base, p),
        controllerClass: className,
        methodName,
        sourceFile: file,
      });
    }
  }

  return endpoints;
}

function inferHttpMethod(annotation: string, args: string): string {
  if (annotation !== "RequestMapping") {
    return annotation.replace("Mapping", "").toUpperCase();
  }
  const m = args.match(/method\s*=\s*RequestMethod\.([A-Z]+)/);
  return m ? m[1] : "GET";
}

function inferPath(args: string): string {
  // @GetMapping("/x") or value="/x" or path="/x"
  const direct = args.match(/^\s*"([^"]+)"/);
  if (direct) return direct[1];
  const v = args.match(/\b(value|path)\s*=\s*"([^"]+)"/);
  if (v) return v[2];
  return "";
}

function extractJavaClassName(content: string): string | null {
  const m = content.match(/\bclass\s+([A-Za-z_]\w*)\b/);
  return m ? m[1] : null;
}

function extractClassBasePath(content: string): string | null {
  const m = content.match(/@RequestMapping\s*\(\s*"([^"]+)"\s*\)/) || content.match(/@RequestMapping\s*\(\s*(?:value|path)\s*=\s*"([^"]+)"\s*\)/);
  return m ? m[1] : null;
}

function extractNextJavaMethodName(content: string, fromIndex: number): string | null {
  const tail = content.slice(fromIndex);
  const m = tail.match(/\b(public|protected|private)\s+[\w<>\[\], ?]+\s+([A-Za-z_]\w*)\s*\(/);
  return m ? m[2] : null;
}

function normalizePath(base: string, p: string): string {
  const joined = `/${base}/${p}`.replace(/\/+/g, "/");
  return joined === "/" ? "/" : joined.replace(/\/$/, "");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

