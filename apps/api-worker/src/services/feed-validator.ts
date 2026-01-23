import Parser from "rss-parser";
import type { FeedValidationResult } from "@trend-monitor/types";

export class FeedValidatorService {
	private parser: Parser;
	private readonly FETCH_TIMEOUT = 10000; // 10 seconds
	private readonly DEFAULT_USER_AGENT =
		"Mozilla/5.0 (compatible; TrendMonitorBot/1.0; +https://trendmonitor.example.com)";

	constructor() {
		this.parser = new Parser({
			timeout: this.FETCH_TIMEOUT,
			customFields: {
				feed: ["subtitle", "updated"],
				item: [["id", "atomId"], "updated"],
			},
		});
	}

	async validate(url: string, customUserAgent?: string): Promise<FeedValidationResult> {
		try {
			// Step 1: Validate URL format
			let parsedUrl: URL;
			try {
				parsedUrl = new URL(url);
			} catch {
				return {
					valid: false,
					error: "Invalid URL format",
				};
			}

			// Ensure http/https protocol
			if (!["http:", "https:"].includes(parsedUrl.protocol)) {
				return {
					valid: false,
					error: "URL must use HTTP or HTTPS protocol",
				};
			}

			// Step 2: Fetch feed with timeout
			const xml = await this.fetchFeed(url, customUserAgent);

			// Step 3: Parse RSS/Atom
			const feed = await this.parseFeed(xml);

			// Step 4: Extract metadata (pass XML to detect format)
			const metadata = this.extractMetadata(feed, xml);

			// Step 5: Extract preview items
			const preview = this.extractPreview(feed.items || [], 10);

			return {
				valid: true,
				metadata,
				preview,
			};
		} catch (err) {
			return {
				valid: false,
				error: this.categorizeError(err),
			};
		}
	}

	private async fetchFeed(url: string, userAgent?: string): Promise<string> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);

		try {
			const response = await fetch(url, {
				headers: {
					"User-Agent": userAgent || this.DEFAULT_USER_AGENT,
					Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const contentType = response.headers.get("content-type") || "";
			if (!this.isValidFeedContentType(contentType)) {
				// Still try to parse, but log warning
				console.warn(`Unexpected content-type: ${contentType} for ${url}`);
			}

			return await response.text();
		} catch (err) {
			clearTimeout(timeoutId);

			if (err instanceof Error) {
				if (err.name === "AbortError") {
					throw new Error("Request timeout: Feed took too long to respond");
				}
				if (err.message.includes("fetch failed")) {
					throw new Error("Network error: Could not connect to feed URL");
				}
			}

			throw err;
		}
	}

	private isValidFeedContentType(contentType: string): boolean {
		const validTypes = [
			"application/rss+xml",
			"application/atom+xml",
			"application/xml",
			"text/xml",
			"application/rdf+xml",
		];
		return validTypes.some((type) => contentType.toLowerCase().includes(type));
	}

	private async parseFeed(xml: string): Promise<any> {
		try {
			const feed = await this.parser.parseString(xml);

			if (!feed) {
				throw new Error("Failed to parse feed: Empty result");
			}

			return feed;
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes("Non-whitespace before first tag")) {
					throw new Error("Parse error: Invalid XML structure");
				}
				if (err.message.includes("Unexpected close tag")) {
					throw new Error("Parse error: Malformed XML");
				}
			}
			throw new Error(`Parse error: ${err instanceof Error ? err.message : "Unknown parsing error"}`);
		}
	}

	private extractMetadata(feed: any, xml: string) {
		// Determine format by checking XML content
		const format: "rss" | "atom" = xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"")
			? "atom"
			: "rss";

		// Extract title (required)
		const title = feed.title || "Untitled Feed";

		// Extract description (use various possible fields)
		const description =
			feed.description || feed.subtitle || feed.itunes?.summary || "No description available";

		// Extract last updated timestamp
		const lastUpdated = feed.lastBuildDate || feed.updated || feed.pubDate || undefined;

		return {
			title: title.trim(),
			description: description.trim(),
			format,
			lastUpdated,
		};
	}

	private extractPreview(items: any[], limit: number = 10) {
		if (!items || items.length === 0) {
			return [];
		}

		return items.slice(0, limit).map((item) => {
			// Extract title
			const title = item.title || "Untitled";

			// Extract link
			const link = item.link || item.guid || "";

			// Extract pub date (try multiple fields)
			const pubDate = item.pubDate || item.isoDate || item.updated || item.date || undefined;

			// Extract content (prefer content, fall back to description)
			const content =
				item.content ||
				item["content:encoded"] ||
				item.contentSnippet ||
				item.description ||
				undefined;

			// Truncate content if too long (preview only)
			const truncatedContent = content
				? content.length > 300
					? `${content.substring(0, 297)}...`
					: content
				: undefined;

			return {
				title: title.trim(),
				link,
				pubDate,
				content: truncatedContent,
			};
		});
	}

	private categorizeError(err: unknown): string {
		if (!(err instanceof Error)) {
			return "Unknown error occurred";
		}

		const message = err.message.toLowerCase();

		// Network errors
		if (message.includes("timeout") || message.includes("abort")) {
			return "Network timeout - feed took too long to respond";
		}
		if (message.includes("network") || message.includes("fetch failed")) {
			return "Network error: Could not connect to feed URL";
		}
		if (message.includes("dns") || message.includes("getaddrinfo")) {
			return "DNS error: Could not resolve hostname";
		}

		// HTTP errors
		if (message.includes("http 404")) {
			return "HTTP 404: Feed not found";
		}
		if (message.includes("http 403")) {
			return "HTTP 403: Access forbidden";
		}
		if (message.includes("http 401")) {
			return "HTTP 401: Authentication required";
		}
		if (message.includes("http 5")) {
			return "HTTP 500+: Server error";
		}

		// Parse errors - check for "not a valid" first
		if (message.includes("not a valid")) {
			return "Not a valid RSS/Atom feed";
		}
		if (message.includes("parse error") || message.includes("xml") || message.includes("feed not recognized")) {
			return "Invalid feed format - not valid RSS/Atom XML";
		}

		// Content errors
		if (message.includes("no items") || message.includes("empty")) {
			return "Content error: Feed contains no items";
		}

		// Generic error
		return `Validation error: ${err.message}`;
	}
}
