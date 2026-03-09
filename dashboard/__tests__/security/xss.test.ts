/**
 * XSS prevention tests.
 * Verifies no dangerouslySetInnerHTML with unsanitized user data.
 * @author Qova Engineering <eng@qova.cc>
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

/** Recursively find all .tsx files in a directory */
function findTsxFiles(dir: string): string[] {
	const results: string[] = [];
	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			try {
				const stat = statSync(fullPath);
				if (stat.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
					results.push(...findTsxFiles(fullPath));
				} else if (entry.endsWith(".tsx")) {
					results.push(fullPath);
				}
			} catch {
				// Skip inaccessible files
			}
		}
	} catch {
		// Skip inaccessible directories
	}
	return results;
}

describe("XSS prevention", () => {
	const srcDir = join(__dirname, "../../src");
	const tsxFiles = findTsxFiles(srcDir);

	it("found TSX files to scan", () => {
		expect(tsxFiles.length).toBeGreaterThan(0);
	});

	it("no dangerouslySetInnerHTML in non-chart components", () => {
		const violations: string[] = [];

		for (const file of tsxFiles) {
			// The shadcn chart UI component is allowed (uses sanitized CSS generation)
			const normalized = file.replace(/\\/g, "/");
			if (normalized.includes("components/ui/chart.tsx")) continue;

			const content = readFileSync(file, "utf-8");
			if (content.includes("dangerouslySetInnerHTML")) {
				violations.push(file);
			}
		}

		expect(violations).toEqual([]);
	});

	it("chart UI component uses sanitized CSS values", () => {
		const chartFile = tsxFiles.find((f) => {
			const normalized = f.replace(/\\/g, "/");
			return normalized.includes("components/ui/chart.tsx");
		});
		expect(chartFile).toBeDefined();

		const content = readFileSync(chartFile!, "utf-8");

		// Should have sanitize functions
		expect(content).toContain("sanitizeCssName");
		expect(content).toContain("sanitizeCssValue");

		// Should NOT have dangerouslySetInnerHTML
		expect(content).not.toContain("dangerouslySetInnerHTML");
	});

	it("no innerHTML usage in source files", () => {
		const violations: string[] = [];

		for (const file of tsxFiles) {
			const content = readFileSync(file, "utf-8");
			// Check for direct innerHTML assignment (not dangerouslySetInnerHTML which is React's API)
			if (/\.innerHTML\s*=/.test(content)) {
				violations.push(file);
			}
		}

		expect(violations).toEqual([]);
	});
});
