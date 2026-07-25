DROP TABLE IF EXISTS im_inbound_dedupe;
DROP TABLE IF EXISTS im_route_bindings;
DROP INDEX IF EXISTS im_identity_bindings_pairing_code_uidx;
DROP TABLE IF EXISTS im_identity_bindings;

ALTER TABLE im_thread_mappings
    DROP COLUMN IF EXISTS peer_kind,
    DROP COLUMN IF EXISTS active_target_ref,
    DROP COLUMN IF EXISTS draft_message_id;

ALTER TABLE im_channel_connections
    DROP CONSTRAINT IF EXISTS im_channel_connections_transport_check,
    DROP CONSTRAINT IF EXISTS im_channel_connections_dm_policy_check,
    DROP CONSTRAINT IF EXISTS im_channel_connections_group_policy_check;

ALTER TABLE im_channel_connections
    DROP COLUMN IF EXISTS config_encrypted,
    DROP COLUMN IF EXISTS transport,
    DROP COLUMN IF EXISTS dm_policy,
    DROP COLUMN IF EXISTS group_policy,
    DROP COLUMN IF EXISTS allow_from,
    DROP COLUMN IF EXISTS streaming_mode,
    DROP COLUMN IF EXISTS last_seen_at;
