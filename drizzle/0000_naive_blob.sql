CREATE TABLE `achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`appid` integer NOT NULL,
	`api_name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`icon` text,
	`icon_gray` text,
	`hidden` integer DEFAULT false NOT NULL,
	`global_percent` real,
	FOREIGN KEY (`appid`) REFERENCES `games`(`appid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `achievements_appid_idx` ON `achievements` (`appid`);--> statement-breakpoint
CREATE INDEX `achievements_rarity_idx` ON `achievements` (`global_percent`);--> statement-breakpoint
CREATE UNIQUE INDEX `achievements_appid_api_name` ON `achievements` (`appid`,`api_name`);--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follows_following_idx` ON `follows` (`following_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`appid` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon_url` text,
	`header_url` text,
	`has_achievements` integer,
	`achievement_count` integer DEFAULT 0 NOT NULL,
	`schema_synced_at` integer,
	`rarity_synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`appid` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note` text,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appid`) REFERENCES `games`(`appid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `list_items_list_idx` ON `list_items` (`list_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_unique_game` ON `list_items` (`list_id`,`appid`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`steam_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'custom' NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`ranked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lists_owner_slug` ON `lists` (`steam_id`,`slug`);--> statement-breakpoint
CREATE TABLE `playtime_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`steam_id` text NOT NULL,
	`appid` integer NOT NULL,
	`playtime_forever` integer NOT NULL,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `snapshots_lookup_idx` ON `playtime_snapshots` (`steam_id`,`appid`,`captured_at`);--> statement-breakpoint
CREATE TABLE `showcases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`steam_id` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showcases_owner_idx` ON `showcases` (`steam_id`,`position`);--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`steam_id` text NOT NULL,
	`achievement_id` integer NOT NULL,
	`appid` integer NOT NULL,
	`unlocked_at` integer,
	PRIMARY KEY(`steam_id`, `achievement_id`),
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`achievement_id`) REFERENCES `achievements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_ach_timeline_idx` ON `user_achievements` (`steam_id`,`unlocked_at`);--> statement-breakpoint
CREATE INDEX `user_ach_app_idx` ON `user_achievements` (`steam_id`,`appid`);--> statement-breakpoint
CREATE TABLE `user_games` (
	`steam_id` text NOT NULL,
	`appid` integer NOT NULL,
	`playtime_forever` integer DEFAULT 0 NOT NULL,
	`playtime_2weeks` integer DEFAULT 0 NOT NULL,
	`last_played_at` integer,
	`unlocked_count` integer DEFAULT 0 NOT NULL,
	`achievements_synced_at` integer,
	PRIMARY KEY(`steam_id`, `appid`),
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appid`) REFERENCES `games`(`appid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_games_steam_idx` ON `user_games` (`steam_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`steam_id` text PRIMARY KEY NOT NULL,
	`persona_name` text NOT NULL,
	`avatar_url` text,
	`profile_url` text,
	`handle` text,
	`bio` text,
	`accent_color` text DEFAULT '#5b8def' NOT NULL,
	`banner_appid` integer,
	`theme` text DEFAULT 'dark' NOT NULL,
	`created_at` integer NOT NULL,
	`library_synced_at` integer,
	`profile_is_private` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);