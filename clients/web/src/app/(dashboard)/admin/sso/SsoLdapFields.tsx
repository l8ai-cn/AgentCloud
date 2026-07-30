import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SSOFormUpdate, SSOFormValues } from "./ssoFormTypes";

export function SsoLdapFields({
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
    <fieldset className="space-y-4 rounded-md border border-border p-4">
      <legend className="px-2 text-sm font-semibold">LDAP settings</legend>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <FormField label="Host" htmlFor="ldap-host" required>
          <Input
            id="ldap-host"
            value={form.ldap_host}
            onChange={(event) => update("ldap_host", event.target.value)}
            placeholder="ldap.example.com"
            disabled={disabled}
          />
        </FormField>
        <FormField label="Port" htmlFor="ldap-port" required>
          <Input
            id="ldap-port"
            type="number"
            min={1}
            max={65535}
            value={form.ldap_port}
            onChange={(event) => update("ldap_port", event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
        <span>
          <span className="block font-medium">Use TLS</span>
          <span className="block text-xs text-muted-foreground">
            Establish the LDAP connection with STARTTLS.
          </span>
        </span>
        <Switch
          checked={form.ldap_use_tls}
          onCheckedChange={(checked) => update("ldap_use_tls", checked)}
          disabled={disabled}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Bind DN" htmlFor="ldap-bind-dn">
          <Input
            id="ldap-bind-dn"
            value={form.ldap_bind_dn}
            onChange={(event) => update("ldap_bind_dn", event.target.value)}
            placeholder="cn=admin,dc=example,dc=com"
            disabled={disabled}
          />
        </FormField>
        <FormField
          label="Bind password"
          htmlFor="ldap-bind-password"
          hint={isEdit ? "Leave blank to keep the current password." : undefined}
        >
          <Input
            id="ldap-bind-password"
            type="password"
            autoComplete="new-password"
            value={form.ldap_bind_password}
            onChange={(event) => update("ldap_bind_password", event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>
      <FormField label="Base DN" htmlFor="ldap-base-dn" required>
        <Input
          id="ldap-base-dn"
          value={form.ldap_base_dn}
          onChange={(event) => update("ldap_base_dn", event.target.value)}
          placeholder="ou=users,dc=example,dc=com"
          disabled={disabled}
        />
      </FormField>
      <FormField label="User filter" htmlFor="ldap-user-filter">
        <Input
          id="ldap-user-filter"
          value={form.ldap_user_filter}
          onChange={(event) => update("ldap_user_filter", event.target.value)}
          placeholder="(uid=%s)"
          disabled={disabled}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <AttributeField label="Email attribute" field="ldap_email_attr" form={form} update={update} disabled={disabled} />
        <AttributeField label="Name attribute" field="ldap_name_attr" form={form} update={update} disabled={disabled} />
        <AttributeField label="Username attribute" field="ldap_username_attr" form={form} update={update} disabled={disabled} />
      </div>
    </fieldset>
  );
}

function AttributeField({
  label,
  field,
  form,
  update,
  disabled,
}: {
  label: string;
  field: "ldap_email_attr" | "ldap_name_attr" | "ldap_username_attr";
  form: SSOFormValues;
  update: SSOFormUpdate;
  disabled: boolean;
}) {
  return (
    <FormField label={label} htmlFor={field}>
      <Input
        id={field}
        value={form[field]}
        onChange={(event) => update(field, event.target.value)}
        disabled={disabled}
      />
    </FormField>
  );
}
