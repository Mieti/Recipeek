CREATE TABLE `ai_queue_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_tick` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ai_imports` ADD `next_run_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_imports` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `ai_import_due` ON `ai_imports` (`status`,`next_run_at`,`lease_until`);--> statement-breakpoint
CREATE INDEX `ai_import_owner_created` ON `ai_imports` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_import_created` ON `ai_imports` (`created_at`);