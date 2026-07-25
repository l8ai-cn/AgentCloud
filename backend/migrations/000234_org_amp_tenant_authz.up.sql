-- AMP tenant ↔ AgentCloud organization (1:1). Empty string treated as unbound.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS amp_tenant_id VARCHAR(100) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_amp_tenant_id
  ON organizations (amp_tenant_id)
  WHERE amp_tenant_id IS NOT NULL AND btrim(amp_tenant_id) <> '';
