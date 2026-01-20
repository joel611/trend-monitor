export interface Checkpoint {
	lastPublishedAt: string; // Feed pubDate/updated timestamp of last processed post
	lastFetchedAt: string; // ISO timestamp when we last fetched
}

export class CheckpointService {
	constructor(private kv: KVNamespace) {}

	async getCheckpoint(feedId: string): Promise<Checkpoint | null> {
		const key = `checkpoint:feed:${feedId}`;
		const value = await this.kv.get(key);

		if (!value) {
			return null;
		}

		return JSON.parse(value) as Checkpoint;
	}

	async saveCheckpoint(feedId: string, checkpoint: Checkpoint): Promise<void> {
		const key = `checkpoint:feed:${feedId}`;
		await this.kv.put(key, JSON.stringify(checkpoint));
	}
}
