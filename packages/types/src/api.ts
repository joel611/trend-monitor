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
