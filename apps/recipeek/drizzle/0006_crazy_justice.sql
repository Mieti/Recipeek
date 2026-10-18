CREATE TABLE `ai_provider_state` (
	`id` text PRIMARY KEY NOT NULL,
	`next_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ai_imports` ADD `input_key` text;--> statement-breakpoint
ALTER TABLE `ai_imports` ADD `generation` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `ai_imports` SET `input_key`=`id` WHERE `input_key` IS NULL;
