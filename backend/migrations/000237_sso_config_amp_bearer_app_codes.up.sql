ALTER TABLE sso_configs
  ADD COLUMN IF NOT EXISTS amp_bearer_app_codes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sso_configs_amp_bearer
  ON sso_configs(protocol, is_enabled)
  WHERE jsonb_array_length(amp_bearer_app_codes) > 0;
