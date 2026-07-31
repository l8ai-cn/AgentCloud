import { useTranslations } from "next-intl";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SSOFormUpdate, SSOFormValues } from "./ssoFormTypes";

export function SsoOidcFields({
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
  const t = useTranslations("admin");
  return (
    <fieldset className="space-y-4 rounded-md border border-border p-4">
      <legend className="px-2 text-sm font-semibold">{t("sso.oidc.legend")}</legend>
      <FormField label={t("sso.oidc.issuerUrl")} htmlFor="oidc-issuer-url" required>
        <Input
          id="oidc-issuer-url"
          type="url"
          value={form.oidc_issuer_url}
          onChange={(event) => update("oidc_issuer_url", event.target.value)}
          placeholder="https://id.example.com"
          disabled={disabled}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("sso.oidc.clientId")} htmlFor="oidc-client-id" required>
          <Input
            id="oidc-client-id"
            value={form.oidc_client_id}
            onChange={(event) => update("oidc_client_id", event.target.value)}
            disabled={disabled}
          />
        </FormField>
        <FormField
          label={t("sso.oidc.clientSecret")}
          htmlFor="oidc-client-secret"
          hint={isEdit ? t("sso.oidc.clientSecretHint") : undefined}
        >
          <Input
            id="oidc-client-secret"
            type="password"
            autoComplete="new-password"
            value={form.oidc_client_secret}
            onChange={(event) => update("oidc_client_secret", event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>
      <FormField label={t("sso.oidc.scopes")} htmlFor="oidc-scopes">
        <Input
          id="oidc-scopes"
          value={form.oidc_scopes}
          onChange={(event) => update("oidc_scopes", event.target.value)}
          placeholder="openid profile email"
          disabled={disabled}
        />
      </FormField>
      <FormField
        label={t("sso.oidc.extraParams")}
        htmlFor="oidc-extra-params"
        hint={t("sso.oidc.extraParamsHint")}
      >
        <Textarea
          id="oidc-extra-params"
          value={form.oidc_authorize_extra_params}
          onChange={(event) => update("oidc_authorize_extra_params", event.target.value)}
          placeholder='{"tenantId":"EXAMPLE"}'
          disabled={disabled}
        />
      </FormField>
      <FormField
        label={t("sso.oidc.ampBearerCodes")}
        htmlFor="amp-bearer-codes"
        hint={t("sso.oidc.ampBearerCodesHint")}
      >
        <Textarea
          id="amp-bearer-codes"
          value={form.amp_bearer_app_codes}
          onChange={(event) => update("amp_bearer_app_codes", event.target.value)}
          placeholder='["ZHIYONG"]'
          disabled={disabled}
        />
      </FormField>
    </fieldset>
  );
}
