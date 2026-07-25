DROP INDEX IF EXISTS idx_sso_configs_default_org;

ALTER TABLE sso_configs
  DROP COLUMN IF EXISTS oidc_authorize_extra_params,
  DROP COLUMN IF EXISTS default_organization_id;
