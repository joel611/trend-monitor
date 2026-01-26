
export enum SourceType {
  REDDIT = 'reddit',
  X = 'x',
  FEED = 'feed'
}

export enum WatchType {
  X_PROFILE = 'x_profile',
  YOUTUBE_CHANNEL = 'youtube_channel'
}

export enum KeywordStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived'
}

export interface Keyword {
  id: string;
  name: string;
  aliases: string[];
  tags: string[];
  status: KeywordStatus;
  mentionsCount7d: number;
  growthRate: number;
  isEmerging: boolean;
}

export interface WatchItem {
  id: string;
  type: WatchType;
  url: string;
  label: string;
  status: 'monitoring' | 'paused';
  lastSync: string;
}

export interface Mention {
  id: string;
  source: SourceType;
  title: string;
  content: string;
  url: string;
  author: string;
  createdAt: string;
  matchedKeywords: string[];
}

export interface AggregatePoint {
  date: string;
  count: number;
  reddit: number;
  x: number;
  feed: number;
}
