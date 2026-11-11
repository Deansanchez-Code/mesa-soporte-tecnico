import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPACE_COORDINATORS } from "./constants";

function collectUseServerFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectUseServerFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (/^\s*["']use server["']\s*;?/m.test(content.slice(0, 300))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

describe("Reglas de módulos Server Actions y coordinadores por defecto", () => {
  it("define coordinadores institucionales predeterminados para Biblioteca, 107 y Cocina", () => {
    expect(DEFAULT_SPACE_COORDINATORS["3"]?.username).toBe("egutierrezn");
    expect(DEFAULT_SPACE_COORDINATORS["4"]?.username).toBe("nbarrerac");
    expect(DEFAULT_SPACE_COORDINATORS["5"]?.username).toBe("nbarrerac");
  });

  it('ningún archivo "use server" exporta valores de runtime distintos a async function', () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const serverActionFiles = collectUseServerFiles(srcDir);
    expect(serverActionFiles.length).toBeGreaterThan(0);

    const invalidExports: string[] = [];
    for (const filePath of serverActionFiles) {
      const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (
          /^\s*export\s+(?!type\b|interface\b|async\s+function\b)/.test(line)
        ) {
          invalidExports.push(
            `${path.relative(process.cwd(), filePath)}:${index + 1}`,
          );
        }
      });
    }

    expect(invalidExports).toEqual([]);
  });
});
