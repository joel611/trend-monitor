/**
 * API Request/Response DTOs
 */

// Keywords API
export interface CreateKeywordRequest {
  name: string;
  aliases?: string[];
  tags?: string[];
}

export interface UpdateKeywordRequest {
  name?: string;
  aliases?: string[];
  tags?: string[];
  status?: "active" | "archived";
}

export interface KeywordResponse {
  id: string;
  name: string;
  aliases: string[];
  tags: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  stats?: {
    last7Days: number;
    last30Days: number;
  };
}

export interface ListKeywordsResponse {
  keywords: KeywordResponse[];
  total: number;
}

// Trends API
export interface TrendsOverviewRequest {
  from?: string;
  to?: string;
}

export interface TrendKeyword {
  keywordId: string;
  name: string;
  currentPeriod: number;
  previousPeriod: number;
  growthRate: number;
  isEmerging: boolean;
}

export interface TrendsOverviewResponse {
  topKeywords: TrendKeyword[];
  emergingKeywords: TrendKeyword[];
  totalMentions: number;
  sourceBreakdown: {
    source: string;
    count: number;
  }[];
}

export interface KeywordTrendRequest {
  from?: string;
  to?: string;
  source?: "reddit" | "x" | "feed";
}

export interface TimeSeriesDataPoint {
  date: string;
  count: number;
  source?: string;
}

export interface KeywordTrendResponse {
  keywordId: string;
  name: string;
  timeSeries: TimeSeriesDataPoint[];
  totalMentions: number;
  averagePerDay: number;
}

// Mentions API
export interface ListMentionsRequest {
  keywordId?: string;
  source?: "reddit" | "x" | "feed";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface MentionResponse {
  id: string;
  source: "reddit" | "x" | "feed";
  sourceId: string;
  title?: string;
  content: string;
  url: string;
  author?: string;
  createdAt: string;
  fetchedAt: string;
  matchedKeywords: string[];
}

export interface ListMentionsResponse {
  mentions: MentionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// Sources API
export interface ValidateFeedRequest {
  url: string;
  customUserAgent?: string;
}

export interface FeedMetadata {
  title: string;
  description: string;
  format: "rss" | "atom";
  lastUpdated?: string;
}

export interface FeedPreviewItem {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
}

export interface ValidateFeedResponse {
  valid: boolean;
  metadata?: FeedMetadata;
  preview?: FeedPreviewItem[];
  error?: string;
}

export interface CreateSourceRequest {
  url: string;
  name: string;
  type: "feed" | "x";
  customUserAgent?: string;
  feedTitle?: string;
  feedDescription?: string;
}

export interface UpdateSourceRequest {
  url?: string;
  name?: string;
  customUserAgent?: string;
  feedTitle?: string;
  feedDescription?: string;
  enabled?: boolean;
}

export interface SourceConfigResponse {
  id: string;
  type: "feed" | "x";
  config: {
    url: string;
    name: string;
    customUserAgent?: string;
    feedTitle?: string;
    feedDescription?: string;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastFetchAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  consecutiveFailures: number;
  deletedAt?: string | null;
  health?: "success" | "warning" | "error";
}

export interface ListSourcesResponse {
  sources: SourceConfigResponse[];
}
