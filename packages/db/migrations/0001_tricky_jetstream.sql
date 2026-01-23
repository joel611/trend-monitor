ALTER TABLE `source_configs` ADD `last_fetch_at` text;--> statement-breakpoint
ALTER TABLE `source_configs` ADD `last_success_at` text;--> statement-breakpoint
ALTER TABLE `source_configs` ADD `last_error_at` text;--> statement-breakpoint
ALTER TABLE `source_configs` ADD `last_error_message` text;--> statement-breakpoint
ALTER TABLE `source_configs` ADD `consecutive_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `source_configs` ADD `deleted_at` text;