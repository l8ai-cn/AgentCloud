import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SSOProtocol } from "@/lib/api/admin/sso";
import type { SSOFormUpdate, SSOFormValues } from "./ssoFormTypes";

export function SsoCommonFields({
  form,
  update,
  isEdit,
  disabled,
}: {
  form: SSOFormValues;
  update: SSOFormUpdate;
  isEdit: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Domain" htmlFor="sso-domain" required disabled={isEdit}>
          <Input
            id="sso-domain"
            value={form.domain}
            onChange={(event) => update("domain", event.target.value)}
            placeholder="example.com"
            disabled={disabled || isEdit}
          />
        </FormField>
        <FormField label="Display name" htmlFor="sso-name" required>
          <Input
            id="sso-name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Company SSO"
            disabled={disabled}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Protocol" disabled={isEdit}>
          <Select
            value={form.protocol}
            onValueChange={(value) => update("protocol", value as SSOProtocol)}
            disabled={disabled || isEdit}
          >
            <SelectTrigger aria-label="SSO protocol">
              <span>{form.protocol.toUpperCase()}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oidc">OIDC</SelectItem>
              <SelectItem value="saml">SAML 2.0</SelectItem>
              <SelectItem value="ldap">LDAP</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Default organization ID"
          htmlFor="default-organization-id"
          hint="Federated users join this organization on login."
        >
          <Input
            id="default-organization-id"
            type="number"
            min={1}
            value={form.default_organization_id}
            onChange={(event) => update("default_organization_id", event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>
      <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
        <ToggleField
          label="Enabled"
          description="Allow this configuration to handle sign-in."
          checked={form.is_enabled}
          onCheckedChange={(checked) => update("is_enabled", checked)}
          disabled={disabled}
        />
        <ToggleField
          label="Enforce SSO"
          description="Require matching users to sign in through this provider."
          checked={form.enforce_sso}
          onCheckedChange={(checked) => update("enforce_sso", checked)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-3 text-sm">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}
