import type { DbClient, Keyword } from "@trend-monitor/db";
import { KeywordsRepository } from "./keywords-repository";

const CACHE_KEY = "active_keywords";
const CACHE_TTL = 300; // 5 minutes

export class KeywordCache {
	private keywordsRepo: KeywordsRepository;

	constructor(
		private db: DbClient,
		private kv: KVNamespace,
	) {
		this.keywordsRepo = new KeywordsRepository(db);
	}

	async getActiveKeywords(): Promise<Keyword[]> {
		// Try KV cache first
		const cached = await this.kv.get(CACHE_KEY, "text");
		if (cached) {
			return JSON.parse(cached);
		}

		// Cache miss - load from DB
		const keywords = await this.keywordsRepo.findActive();

		// Update cache
		await this.kv.put(CACHE_KEY, JSON.stringify(keywords), {
			expirationTtl: CACHE_TTL,
		});

		return keywords;
	}
}
