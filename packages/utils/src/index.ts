export function normalizeText(text: string): string {
	return text.toLowerCase().trim();
}

export function matchKeyword(text: string, keyword: string, aliases: string[]): boolean {
	const normalized = normalizeText(text);
	const terms = [keyword, ...aliases].map(normalizeText);
	return terms.some((term) => normalized.includes(term));
}

export function toDateBucket(date: Date): string {
	return date.toISOString().split("T")[0];
}
