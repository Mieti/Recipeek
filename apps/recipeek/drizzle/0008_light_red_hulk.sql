CREATE TABLE `ai_import_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`provider` text NOT NULL,
	`month` text NOT NULL,
	`charge` integer NOT NULL,
	`known` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_budget_month` ON `ai_import_budget` (`provider`,`month`);