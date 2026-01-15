export const AGGREGATION_WINDOWS = {
	week: 7,
	month: 30,
	quarter: 90,
} as const;

export const EMERGING_THRESHOLDS = {
	minPrevious: 3,
	minCurrent: 10,
} as const;

export const SOURCES = ["reddit", "x", "feed"] as const;
