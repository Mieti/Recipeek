CREATE UNIQUE INDEX `ai_import_generation` ON `ai_imports` (`input_key`,`generation`);--> statement-breakpoint
CREATE INDEX `ai_import_lease` ON `ai_imports` (`lease_until`);