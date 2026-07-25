DROP INDEX IF EXISTS idx_organizations_amp_tenant_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS amp_tenant_id;
