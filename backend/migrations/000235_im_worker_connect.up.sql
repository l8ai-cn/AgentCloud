-- IM worker connect: encrypted config, ACL policies, identity pairing, route bindings, durable dedupe.

ALTER TABLE im_channel_connections
    ADD COLUMN IF NOT EXISTS config_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS transport VARCHAR(16) NOT NULL DEFAULT 'webhook',
    ADD COLUMN IF NOT EXISTS dm_policy VARCHAR(16) NOT NULL DEFAULT 'pairing',
    ADD COLUMN IF NOT EXISTS group_policy VARCHAR(16) NOT NULL DEFAULT 'allowlist',
    ADD COLUMN IF NOT EXISTS allow_from JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS streaming_mode VARCHAR(16) NOT NULL DEFAULT 'progress',
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE im_channel_connections
    DROP CONSTRAINT IF EXISTS im_channel_connections_transport_check;
ALTER TABLE im_channel_connections
    ADD CONSTRAINT im_channel_connections_transport_check
    CHECK (transport IN ('webhook', 'stream'));

ALTER TABLE im_channel_connections
    DROP CONSTRAINT IF EXISTS im_channel_connections_dm_policy_check;
ALTER TABLE im_channel_connections
    ADD CONSTRAINT im_channel_connections_dm_policy_check
    CHECK (dm_policy IN ('pairing', 'open', 'allowlist', 'disabled', 'guest'));

ALTER TABLE im_channel_connections
    DROP CONSTRAINT IF EXISTS im_channel_connections_group_policy_check;
ALTER TABLE im_channel_connections
    ADD CONSTRAINT im_channel_connections_group_policy_check
    CHECK (group_policy IN ('open', 'allowlist', 'disabled'));

ALTER TABLE im_thread_mappings
    ADD COLUMN IF NOT EXISTS peer_kind VARCHAR(16) NOT NULL DEFAULT 'group',
    ADD COLUMN IF NOT EXISTS active_target_ref VARCHAR(255),
    ADD COLUMN IF NOT EXISTS draft_message_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS im_identity_bindings (
    id BIGSERIAL PRIMARY KEY,
    connection_id BIGINT NOT NULL REFERENCES im_channel_connections(id) ON DELETE CASCADE,
    external_user_id VARCHAR(255) NOT NULL,
    external_name VARCHAR(255),
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    pairing_code VARCHAR(16),
    pairing_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (connection_id, external_user_id),
    CHECK (status IN ('pending', 'bound', 'blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS im_identity_bindings_pairing_code_uidx
    ON im_identity_bindings (pairing_code)
    WHERE status = 'pending' AND pairing_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS im_route_bindings (
    id BIGSERIAL PRIMARY KEY,
    connection_id BIGINT NOT NULL REFERENCES im_channel_connections(id) ON DELETE CASCADE,
    peer_kind VARCHAR(16) NOT NULL,
    peer_id VARCHAR(512),
    target_kind VARCHAR(16) NOT NULL,
    target_ref VARCHAR(255) NOT NULL,
    require_mention BOOLEAN NOT NULL DEFAULT FALSE,
    priority INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (peer_kind IN ('direct', 'group', 'any')),
    CHECK (target_kind IN ('pod', 'expert', 'channel'))
);

CREATE INDEX IF NOT EXISTS im_route_bindings_connection_priority_idx
    ON im_route_bindings (connection_id, peer_kind, priority);

CREATE TABLE IF NOT EXISTS im_inbound_dedupe (
    connection_id BIGINT NOT NULL,
    external_message_id VARCHAR(255) NOT NULL,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (connection_id, external_message_id)
);

CREATE INDEX IF NOT EXISTS im_inbound_dedupe_seen_at_idx ON im_inbound_dedupe (seen_at);
