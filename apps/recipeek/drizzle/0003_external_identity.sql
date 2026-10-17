CREATE TABLE `external_identities` (
	`auth_user_id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_identities_profile_id_unique` ON `external_identities` (`profile_id`);