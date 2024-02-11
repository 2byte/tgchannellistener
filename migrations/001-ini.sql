------------------------------------------------------------
-- UP
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `telegram_channels` (
    `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    `name` varchar(255) NOT NULL,
    `url` varchar(255) NOT NULL,
    `status` varchar(255) NOT NULL,
    `tracking_end_date` TIMESTAMPS NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `track_type` varchar(255) NOT NULL,
    `track_type_lastmessage_quantity` integer DEFAULT 0,
    `last_message_id` integer DEFAULT 0,
    `is_new` tinyint DEFAULT 0,
    `wait_send_message` text DEFAULT NULL,
    `created_at` TIMESTAMPS NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMPS NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER `telegram_channels_update_at`
AFTER UPDATE ON `telegram_channels`
FOR EACH ROW
BEGIN
  UPDATE `telegram_channels` SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id AND updated_at != CURRENT_TIMESTAMP;
END;
-----------------------------------------------------------
-- DOWN
-----------------------------------------------------------

DROP TABLE IF EXISTS `telegram_channels`;
