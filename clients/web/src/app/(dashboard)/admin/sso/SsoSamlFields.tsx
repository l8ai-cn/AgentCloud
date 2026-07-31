import { useTranslations } from "next-intl";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SSOFormUpdate, SSOFormValues } from "./ssoFormTypes";

export function SsoSamlFields({
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
  const secretHint = isEdit ? t("sso.saml.secretHint") : undefined;
  return (
    <fieldset className="space-y-4 rounded-md border border-border p-4">
      <legend className="px-2 text-sm font-semibold">{t("sso.saml.legend")}</legend>
      <FormField label={t("sso.saml.metadataUrl")} htmlFor="saml-metadata-url">
        <Input
          id="saml-metadata-url"
          type="url"
          value={form.saml_idp_metadata_url}
          onChange={(event) => update("saml_idp_metadata_url", event.target.value)}
          placeholder="https://idp.example.com/metadata"
          disabled={disabled}
        />
      </FormField>
      <FormField
        label={t("sso.saml.metadataXml")}
        htmlFor="saml-metadata-xml"
        hint={secretHint}
      >
        <Textarea
          id="saml-metadata-xml"
          value={form.saml_idp_metadata_xml}
          onChange={(event) => update("saml_idp_metadata_xml", event.target.value)}
          placeholder="<EntityDescriptor ...>"
          className="min-h-24 font-mono text-xs"
          disabled={disabled}
        />
      </FormField>
      <FormField label={t("sso.saml.ssoUrl")} htmlFor="saml-sso-url">
        <Input
          id="saml-sso-url"
          type="url"
          value={form.saml_idp_sso_url}
          onChange={(event) => update("saml_idp_sso_url", event.target.value)}
          placeholder="https://idp.example.com/sso"
          disabled={disabled}
        />
      </FormField>
      <FormField label={t("sso.saml.certificate")} htmlFor="saml-certificate" hint={secretHint}>
        <Textarea
          id="saml-certificate"
          value={form.saml_idp_cert}
          onChange={(event) => update("saml_idp_cert", event.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----"
          className="min-h-24 font-mono text-xs"
          disabled={disabled}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("sso.saml.spEntityId")} htmlFor="saml-entity-id">
          <Input
            id="saml-entity-id"
            value={form.saml_sp_entity_id}
            onChange={(event) => update("saml_sp_entity_id", event.target.value)}
            disabled={disabled}
          />
        </FormField>
        <FormField label={t("sso.saml.nameIdFormat")} htmlFor="saml-name-id-format">
          <Input
            id="saml-name-id-format"
            value={form.saml_name_id_format}
            onChange={(event) => update("saml_name_id_format", event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>
    </fieldset>
  );
}
