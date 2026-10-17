CREATE TABLE `request_limits` (
	`owner_id` text NOT NULL,
	`scope` text NOT NULL,
	`window_start` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`hits` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `scope`, `window_start`)
);
--> statement-breakpoint
ALTER TABLE `uploads` ADD `byte_size` integer DEFAULT 6000000 NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `state` text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `uploads` ADD `last_used_at` text;
--> statement-breakpoint
CREATE INDEX uploads_owner_state ON uploads(owner_id,state,created_at);
--> statement-breakpoint
CREATE INDEX recipes_owner ON recipes(owner_id);
--> statement-breakpoint
CREATE INDEX request_limits_expiry ON request_limits(expires_at);
--> statement-breakpoint
CREATE TRIGGER recipes_media_insert BEFORE INSERT ON recipes BEGIN
 SELECT RAISE(ABORT,'INVALID_MEDIA') WHERE EXISTS (
  SELECT value FROM (SELECT json_extract(NEW.document,'$.image') AS value UNION ALL SELECT json_extract(value,'$.image') FROM json_each(NEW.document,'$.steps'))
  WHERE value LIKE '/api/media/%' AND NOT EXISTS (SELECT 1 FROM uploads u WHERE u.id=substr(value,12) AND u.owner_id=NEW.owner_id AND u.state='ready')
 );
END;
--> statement-breakpoint
CREATE TRIGGER recipes_media_update BEFORE UPDATE OF document,owner_id ON recipes BEGIN
 SELECT RAISE(ABORT,'INVALID_MEDIA') WHERE EXISTS (
  SELECT value FROM (SELECT json_extract(NEW.document,'$.image') AS value UNION ALL SELECT json_extract(value,'$.image') FROM json_each(NEW.document,'$.steps'))
  WHERE value LIKE '/api/media/%' AND NOT EXISTS (SELECT 1 FROM uploads u WHERE u.id=substr(value,12) AND u.owner_id=NEW.owner_id AND u.state='ready')
 );
END;
--> statement-breakpoint
CREATE TRIGGER recipes_media_detach AFTER UPDATE OF document ON recipes BEGIN
 UPDATE uploads SET last_used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE owner_id=OLD.owner_id AND ('/api/media/'||id=json_extract(OLD.document,'$.image') OR id IN (SELECT substr(json_extract(value,'$.image'),12) FROM json_each(OLD.document,'$.steps')));
END;
--> statement-breakpoint
CREATE TRIGGER recipes_media_delete AFTER DELETE ON recipes BEGIN
 UPDATE uploads SET last_used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE owner_id=OLD.owner_id AND ('/api/media/'||id=json_extract(OLD.document,'$.image') OR id IN (SELECT substr(json_extract(value,'$.image'),12) FROM json_each(OLD.document,'$.steps')));
END;
