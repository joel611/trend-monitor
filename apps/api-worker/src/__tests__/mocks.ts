/**
 * Mock implementations for Cloudflare bindings (D1, KV, Queue)
 * Used in tests to simulate Cloudflare Workers environment
 */

export class MockD1Database {
	private data: Map<string, unknown[]> = new Map();

	prepare(_query: string) {
		const self = this;
		return {
			bind(..._params: unknown[]) {
				return {
					async all() {
						return {
							results: self.data.get("results") || [],
							success: true,
							meta: {},
						};
					},
					async first() {
						const results = self.data.get("results") || [];
						return results[0] || null;
					},
					async run() {
						return {
							success: true,
							meta: {
								changes: 1,
								last_row_id: 1,
								rows_read: 0,
								rows_written: 1,
							},
						};
					},
				};
			},
		};
	}

	seed(_table: string, data: unknown[]) {
		this.data.set("results", data);
	}

	reset() {
		this.data.clear();
	}
}

export class MockKVNamespace {
	private data: Map<string, string> = new Map();

	async get(key: string): Promise<string | null> {
		return this.data.get(key) || null;
	}

	async put(key: string, value: string): Promise<void> {
		this.data.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.data.delete(key);
	}

	async list(): Promise<{ keys: Array<{ name: string }> }> {
		return {
			keys: Array.from(this.data.keys()).map((name) => ({ name })),
		};
	}

	reset() {
		this.data.clear();
	}
}

export class MockQueue {
	private messages: unknown[] = [];

	async send(message: unknown): Promise<void> {
		this.messages.push(message);
	}

	async sendBatch(messages: unknown[]): Promise<void> {
		this.messages.push(...messages);
	}

	getMessages(): unknown[] {
		return this.messages;
	}

	reset() {
		this.messages = [];
	}
}

export interface MockEnv {
	DB: MockD1Database;
	CACHE: MockKVNamespace;
	INGESTION_QUEUE: MockQueue;
}

export function createMockEnv(): MockEnv {
	return {
		DB: new MockD1Database(),
		CACHE: new MockKVNamespace(),
		INGESTION_QUEUE: new MockQueue(),
	};
}
