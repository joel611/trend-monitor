
import React from 'react';
import { Keyword, Mention, SourceType, KeywordStatus, AggregatePoint, WatchItem, WatchType } from './types';

export const MOCK_KEYWORDS: Keyword[] = [
  { id: '1', name: 'ElysiaJS', aliases: ['Elysia'], tags: ['framework', 'typescript'], status: KeywordStatus.ACTIVE, mentionsCount7d: 450, growthRate: 15, isEmerging: false },
  { id: '2', name: 'Cloudflare D1', aliases: ['D1', 'CF D1'], tags: ['database', 'serverless'], status: KeywordStatus.ACTIVE, mentionsCount7d: 320, growthRate: 85, isEmerging: true },
  { id: '3', name: 'Bun', aliases: ['Bun.sh'], tags: ['runtime', 'js'], status: KeywordStatus.ACTIVE, mentionsCount7d: 890, growthRate: -5, isEmerging: false },
  { id: '4', name: 'React 19', aliases: ['React RC'], tags: ['frontend', 'react'], status: KeywordStatus.ACTIVE, mentionsCount7d: 1200, growthRate: 120, isEmerging: true },
  { id: '5', name: 'HTMX', aliases: [], tags: ['frontend', 'hypermedia'], status: KeywordStatus.ACTIVE, mentionsCount7d: 150, growthRate: 2, isEmerging: false },
];

export const MOCK_WATCH_LIST: WatchItem[] = [
  { id: 'w1', type: WatchType.X_PROFILE, label: 'Primeagen', url: 'https://x.com/theprimeagen', status: 'monitoring', lastSync: '2024-05-20T14:00:00Z' },
  { id: 'w2', type: WatchType.YOUTUBE_CHANNEL, label: 'Fireship', url: 'https://youtube.com/@fireship', status: 'monitoring', lastSync: '2024-05-20T12:30:00Z' },
  { id: 'w3', type: WatchType.X_PROFILE, label: 'Tobi Lütke', url: 'https://x.com/tobi', status: 'paused', lastSync: '2024-05-19T09:00:00Z' }
];

export const MOCK_MENTIONS: Mention[] = [
  {
    id: 'm1',
    source: SourceType.REDDIT,
    title: 'Why Cloudflare D1 is the future of edge databases',
    content: 'I recently switched my ElysiaJS app to use D1 and the latency is incredible...',
    url: 'https://reddit.com/r/cloudflare/comments/123',
    author: 'edge_dev_24',
    createdAt: '2024-05-20T10:00:00Z',
    matchedKeywords: ['1', '2']
  },
  {
    id: 'm2',
    source: SourceType.X,
    title: '',
    content: 'Just deployed my first Bun server on Fly.io. Insanely fast startup times compared to Node. #bun #javascript',
    url: 'https://twitter.com/dev_guru/status/987',
    author: 'dev_guru',
    createdAt: '2024-05-20T11:30:00Z',
    matchedKeywords: ['3']
  },
  {
    id: 'm3',
    source: SourceType.FEED,
    title: 'The state of React 19: What to expect',
    content: 'React 19 brings exciting new features like the React Compiler and Actions...',
    url: 'https://techblog.com/react-19-guide',
    author: 'Sarah Chen',
    createdAt: '2024-05-19T09:00:00Z',
    matchedKeywords: ['4']
  }
];

export const generateMockTimeSeries = (days: number): AggregatePoint[] => {
  const data: AggregatePoint[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const reddit = Math.floor(Math.random() * 50) + 10;
    const x = Math.floor(Math.random() * 40) + 5;
    const feed = Math.floor(Math.random() * 15) + 2;
    data.push({
      date: d.toISOString().split('T')[0],
      count: reddit + x + feed,
      reddit,
      x,
      feed
    });
  }
  return data;
};
