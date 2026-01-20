import { describe, expect, test } from "bun:test";
import { htmlToText } from "./html-to-text";

describe("htmlToText", () => {
	test("should strip HTML tags", () => {
		const html = "<p>This is <strong>bold</strong> text.</p>";
		const text = htmlToText(html);
		expect(text).toBe("This is bold text.");
	});

	test("should decode HTML entities", () => {
		const html = "<p>Quotes: &quot;hello&quot; and &amp; symbol</p>";
		const text = htmlToText(html);
		expect(text).toBe('Quotes: "hello" and & symbol');
	});

	test("should handle line breaks", () => {
		const html = "<p>Line 1</p><p>Line 2</p>";
		const text = htmlToText(html);
		expect(text).toBe("Line 1\n\nLine 2");
	});

	test("should handle links", () => {
		const html = '<a href="https://example.com">Link text</a>';
		const text = htmlToText(html);
		expect(text).toBe("Link text");
	});

	test("should handle empty or whitespace-only content", () => {
		expect(htmlToText("")).toBe("");
		expect(htmlToText("   ")).toBe("");
		expect(htmlToText("<p></p>")).toBe("");
	});

	test("should preserve code blocks", () => {
		const html =
			"<p>Check out this code:</p><pre><code>const x = 42;</code></pre><p>Pretty cool!</p>";
		const text = htmlToText(html);
		expect(text).toContain("Check out this code:");
		expect(text).toContain("const x = 42;");
		expect(text).toContain("Pretty cool!");
	});
});
