-- Bot-authored text (pairing prompts, slash-command replies, progress drafts)
-- is read by the IM workspace, not by an AgentsMesh user, so the language is a
-- property of the connection rather than of any signed-in account.
ALTER TABLE im_channel_connections
    ADD COLUMN IF NOT EXISTS locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN';

ALTER TABLE im_channel_connections
    DROP CONSTRAINT IF EXISTS im_channel_connections_locale_check;

ALTER TABLE im_channel_connections
    ADD CONSTRAINT im_channel_connections_locale_check
    CHECK (locale IN ('en', 'zh-CN'));

UPDATE im_channel_connections SET locale = 'en' WHERE provider = 'slack';
