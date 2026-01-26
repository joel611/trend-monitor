import { mock } from "bun:test";
import { createMockDB } from "@trend-monitor/db/mock";

export const mockDb = createMockDB();

// Mock KV store
const kvStore = new Map<string, string>();
export const mockKV: KVNamespace = {
	get: async (key: string) => kvStore.get(key) || null,
	put: async (key: string, value: string) => {
		kvStore.set(key, value);
	},
	delete: async (key: string) => {
		kvStore.delete(key);
	},
	list: async () => ({ keys: [], list_complete: true, cursor: "" }),
	getWithMetadata: async () => ({ value: null, metadata: null }),
} as any;

// Mock Queue
const queueMessages: any[] = [];
export const mockQueue = {
	send: mock(async (message: any) => {
		queueMessages.push(message);
	}),
	sendBatch: mock(async (messages: any[]) => {
		queueMessages.push(...messages);
	}),
} as any;

// Export function to clear queue messages for test assertions
export function getMockQueueMessages() {
	return queueMessages;
}

export function clearMockQueue() {
	queueMessages.length = 0;
}

// Export function to clear KV store
export function clearMockKV() {
	kvStore.clear();
}

mock.module("cloudflare:workers", () => ({
	env: {
		DB: mockDb,
		CHECKPOINT: mockKV,
		INGESTION_QUEUE: mockQueue,
		FEED_USER_AGENT: "test-agent/1.0",
	},
}));
