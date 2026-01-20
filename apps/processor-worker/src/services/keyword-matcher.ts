import type { Keyword } from "@trend-monitor/db";
import { matchKeyword } from "@trend-monitor/utils";

export class KeywordMatcher {
	matchKeywords(text: string, keywords: Keyword[]): string[] {
		const matches = new Set<string>();

		for (const keyword of keywords) {
			if (matchKeyword(text, keyword.name, keyword.aliases)) {
				matches.add(keyword.id);
			}
		}

		return Array.from(matches);
	}
}
