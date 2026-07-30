"use client";

import { useEffect, useState } from "react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  SSOConfig,
  SSOConfigInput,
  UpdateSSOConfigInput,
} from "@/lib/api/admin/sso";
import { getErrorMessage } from "@/lib/utils";
import { SsoCommonFields } from "./SsoCommonFields";
import { SsoLdapFields } from "./SsoLdapFields";
import { SsoOidcFields } from "./SsoOidcFields";
import { SsoSamlFields } from "./SsoSamlFields";
import {
  createInputFromForm,
  emptySSOForm,
  formFromSSOConfig,
  updateInputFromForm,
  type SSOFormUpdate,
  type SSOFormValues,
} from "./ssoFormTypes";
import { validateSSOForm } from "./ssoFormValidation";

interface SsoFormDialogProps {
  open: boolean;
  config: SSOConfig | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: SSOConfigInput) => Promise<void>;
  onUpdate: (id: number, input: UpdateSSOConfigInput) => Promise<void>;
}

export function SsoFormDialog({
  open,
  config,
  onOpenChange,
  onCreate,
  onUpdate,
}: SsoFormDialogProps) {
  const [form, setForm] = useState<SSOFormValues>({ ...emptySSOForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = config !== null;

  useEffect(() => {
    if (!open) return;
    setForm(config ? formFromSSOConfig(config) : { ...emptySSOForm });
    setError(null);
  }, [config, open]);

  const update: SSOFormUpdate = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateSSOForm(form, isEdit);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (config) {
        await onUpdate(config.id, updateInputFromForm(form));
      } else {
        await onCreate(createInputFromForm(form));
      }
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to save SSO configuration."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit SSO configuration" : "Create SSO configuration"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Domain and protocol are immutable. Blank secrets keep their current values."
              : "Configure a domain-specific identity provider for platform sign-in."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <DialogBody className="space-y-5">
            {error && <AlertMessage type="error" message={error} />}
            <SsoCommonFields form={form} update={update} isEdit={isEdit} disabled={saving} />
            {form.protocol === "oidc" && (
              <SsoOidcFields form={form} update={update} isEdit={isEdit} disabled={saving} />
            )}
            {form.protocol === "saml" && (
              <SsoSamlFields form={form} update={update} isEdit={isEdit} disabled={saving} />
            )}
            {form.protocol === "ldap" && (
              <SsoLdapFields form={form} update={update} isEdit={isEdit} disabled={saving} />
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "Save changes" : "Create configuration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
