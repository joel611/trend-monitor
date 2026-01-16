import { describe, expect, test } from "bun:test";
import app from "./index";

describe("API Worker", () => {
	describe("GET /api/health", () => {
		test("returns 200 status", async () => {
			const response = await app.handle(new Request("http://localhost/api/health"));

			expect(response.status).toBe(200);
		});

		test("returns correct response body", async () => {
			const response = await app.handle(new Request("http://localhost/api/health"));

			const data = await response.json();
			expect(data).toEqual({ status: "ok" });
		});

		test("returns JSON content type", async () => {
			const response = await app.handle(new Request("http://localhost/api/health"));

			const contentType = response.headers.get("content-type");
			expect(contentType).toContain("application/json");
		});
	});

	describe("GET /api/keywords", () => {
		test("returns 200 status", async () => {
			const response = await app.handle(new Request("http://localhost/api/keywords"));

			expect(response.status).toBe(200);
		});

		test("returns empty keywords array initially", async () => {
			const response = await app.handle(new Request("http://localhost/api/keywords"));

			const data = await response.json();
			expect(data).toEqual({ keywords: [] });
		});

		test("returns JSON content type", async () => {
			const response = await app.handle(new Request("http://localhost/api/keywords"));

			const contentType = response.headers.get("content-type");
			expect(contentType).toContain("application/json");
		});
	});

	describe("404 handling", () => {
		test("returns 404 for unknown routes", async () => {
			const response = await app.handle(new Request("http://localhost/api/unknown"));

			expect(response.status).toBe(404);
		});
	});

	describe("HTTP methods", () => {
		test("GET method works for health endpoint", async () => {
			const response = await app.handle(
				new Request("http://localhost/api/health", { method: "GET" }),
			);

			expect(response.status).toBe(200);
		});

		test("HEAD method works for health endpoint", async () => {
			const response = await app.handle(
				new Request("http://localhost/api/health", { method: "HEAD" }),
			);

			// Elysia supports HEAD requests
			expect(response.status).toBe(200);
		});
	});
});
