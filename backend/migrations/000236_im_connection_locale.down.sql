ALTER TABLE im_channel_connections
    DROP CONSTRAINT IF EXISTS im_channel_connections_locale_check;

ALTER TABLE im_channel_connections
    DROP COLUMN IF EXISTS locale;
