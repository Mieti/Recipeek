CREATE TABLE `ai_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`status` text NOT NULL,
	`document` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
