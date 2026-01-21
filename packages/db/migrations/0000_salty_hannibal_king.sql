CREATE TABLE `daily_aggregates` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`keyword_id` text NOT NULL,
	`source` text NOT NULL,
	`mentions_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_aggregates_date_keyword_id_source_unique` ON `daily_aggregates` (`date`,`keyword_id`,`source`);--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_name_unique` ON `keywords` (`name`);--> statement-breakpoint
CREATE TABLE `mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`url` text NOT NULL,
	`author` text,
	`created_at` text NOT NULL,
	`fetched_at` text NOT NULL,
	`matched_keywords` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mentions_source_source_id_unique` ON `mentions` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `source_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
