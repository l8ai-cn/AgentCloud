DROP INDEX IF EXISTS idx_sso_configs_amp_bearer;

ALTER TABLE sso_configs
  DROP COLUMN IF EXISTS amp_bearer_app_codes;
