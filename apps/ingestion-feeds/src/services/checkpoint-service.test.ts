import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CheckpointService } from "./checkpoint-service";

describe("CheckpointService", () => {
	let service: CheckpointService;
	let mockKV: KVNamespace;

	beforeEach(() => {
		mockKV = {
			get: mock(() => Promise.resolve(null)),
			put: mock(() => Promise.resolve()),
		} as any;

		service = new CheckpointService(mockKV);
	});

	test("should get checkpoint for a feed", async () => {
		(mockKV.get as any).mockResolvedValueOnce(
			JSON.stringify({
				lastPublishedAt: "Mon, 20 Jan 2026 10:00:00 +0000",
				lastFetchedAt: "2026-01-20T11:00:00Z",
			}),
		);

		const checkpoint = await service.getCheckpoint("feed-123");

		expect(checkpoint).toEqual({
			lastPublishedAt: "Mon, 20 Jan 2026 10:00:00 +0000",
			lastFetchedAt: "2026-01-20T11:00:00Z",
		});
		expect(mockKV.get).toHaveBeenCalledWith("checkpoint:feed:feed-123");
	});

	test("should return null for missing checkpoint", async () => {
		const checkpoint = await service.getCheckpoint("new-feed");
		expect(checkpoint).toBeNull();
	});

	test("should save checkpoint", async () => {
		await service.saveCheckpoint("feed-456", {
			lastPublishedAt: "Mon, 20 Jan 2026 11:00:00 +0000",
			lastFetchedAt: "2026-01-20T12:00:00Z",
		});

		expect(mockKV.put).toHaveBeenCalledWith(
			"checkpoint:feed:feed-456",
			JSON.stringify({
				lastPublishedAt: "Mon, 20 Jan 2026 11:00:00 +0000",
				lastFetchedAt: "2026-01-20T12:00:00Z",
			}),
		);
	});
});
