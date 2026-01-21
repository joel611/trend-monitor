import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Keywords table
export const keywords = sqliteTable("keywords", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
	tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
	status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Mentions table
export const mentions = sqliteTable(
	"mentions",
	{
		id: text("id").primaryKey(),
		source: text("source", { enum: ["reddit", "x", "feed"] }).notNull(),
		sourceId: text("source_id").notNull(),
		title: text("title"),
		content: text("content").notNull(),
		url: text("url").notNull(),
		author: text("author"),
		createdAt: text("created_at").notNull(),
		fetchedAt: text("fetched_at").notNull(),
		matchedKeywords: text("matched_keywords", { mode: "json" })
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'`),
	},
	(table) => ({
		uniqSourceId: unique().on(table.source, table.sourceId),
	}),
);

// Daily aggregates table
export const dailyAggregates = sqliteTable(
	"daily_aggregates",
	{
		id: text("id").primaryKey(),
		date: text("date").notNull(),
		keywordId: text("keyword_id").notNull(),
		source: text("source", { enum: ["reddit", "x", "feed"] }).notNull(),
		mentionsCount: integer("mentions_count").notNull().default(0),
	},
	(table) => ({
		uniqDateKeywordSource: unique().on(table.date, table.keywordId, table.source),
	}),
);

// Source configurations table
export const sourceConfigs = sqliteTable("source_configs", {
	id: text("id").primaryKey(),
	type: text("type", { enum: ["feed", "x"] }).notNull(),
	config: text("config", { mode: "json" }).$type<Record<string, any>>().notNull(),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Export types inferred from schema
export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = typeof keywords.$inferInsert;
export type Mention = typeof mentions.$inferSelect;
export type InsertMention = typeof mentions.$inferInsert;
export type DailyAggregate = typeof dailyAggregates.$inferSelect;
export type InsertDailyAggregate = typeof dailyAggregates.$inferInsert;
export type SourceConfig = typeof sourceConfigs.$inferSelect;
export type InsertSourceConfig = typeof sourceConfigs.$inferInsert;
