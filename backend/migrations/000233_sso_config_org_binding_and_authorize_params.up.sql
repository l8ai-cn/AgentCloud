ALTER TABLE sso_configs
  ADD COLUMN IF NOT EXISTS default_organization_id BIGINT NULL REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oidc_authorize_extra_params JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sso_configs_default_org
  ON sso_configs(default_organization_id)
  WHERE default_organization_id IS NOT NULL;
