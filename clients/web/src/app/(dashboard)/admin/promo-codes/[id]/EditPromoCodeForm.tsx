"use client";

import { useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdminPromoCode,
  UpdateAdminPromoCodeInput,
} from "@/lib/api/admin/promoTypes";
import { toDateTimeLocal } from "../promoCodePresentation";

interface EditPromoCodeFormProps {
  code: AdminPromoCode;
  saving: boolean;
  onSubmit: (input: UpdateAdminPromoCodeInput) => Promise<void>;
}

function parsePositiveInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

export function EditPromoCodeForm({
  code,
  saving,
  onSubmit,
}: EditPromoCodeFormProps) {
  const initialExpiration = toDateTimeLocal(code.expires_at);
  const [name, setName] = useState(code.name);
  const [description, setDescription] = useState(code.description);
  const [maxUses, setMaxUses] = useState(
    code.max_uses === null ? "" : String(code.max_uses),
  );
  const [maxUsesPerOrg, setMaxUsesPerOrg] = useState(
    String(code.max_uses_per_org),
  );
  const [expiration, setExpiration] = useState(initialExpiration);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== code.name ||
    description.trim() !== code.description ||
    (maxUses !== "" && Number(maxUses) !== code.max_uses) ||
    Number(maxUsesPerOrg) !== code.max_uses_per_org ||
    expiration !== initialExpiration;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const input: UpdateAdminPromoCodeInput = {};
      if (name.trim() !== code.name) input.name = name.trim();
      if (description.trim() !== code.description) {
        input.description = description.trim();
      }
      if (maxUses !== "" && Number(maxUses) !== code.max_uses) {
        input.max_uses = parsePositiveInteger(maxUses, "Maximum uses");
      }
      const perOrg = parsePositiveInteger(
        maxUsesPerOrg,
        "Uses per organization",
      );
      if (perOrg !== code.max_uses_per_org) input.max_uses_per_org = perOrg;
      if (expiration !== initialExpiration) {
        input.expires_at = expiration
          ? new Date(expiration).toISOString()
          : "";
      }
      await onSubmit(input);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update promo code.",
      );
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-md border border-border bg-surface-raised p-5"
    >
      <div>
        <h2 className="text-sm font-semibold">Editable settings</h2>
        <p className="text-xs text-muted-foreground">
          Code, type, plan, duration, and start time are immutable in the backend.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" htmlFor="promo-name" required>
          <Input id="promo-name" required maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setError(null); }} />
        </FormField>
        <FormField label="Expires at" htmlFor="promo-expires" hint="Clear the value to remove expiration.">
          <Input id="promo-expires" type="datetime-local" value={expiration} onChange={(event) => { setExpiration(event.target.value); setError(null); }} />
        </FormField>
      </div>
      <FormField label="Description" htmlFor="promo-description">
        <Textarea id="promo-description" rows={3} value={description} onChange={(event) => { setDescription(event.target.value); setError(null); }} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Total use limit"
          htmlFor="promo-max-uses"
          hint="Blank leaves the current limit unchanged; the API cannot reset a finite limit to unlimited."
        >
          <Input id="promo-max-uses" type="number" min={Math.max(1, code.used_count)} value={maxUses} onChange={(event) => { setMaxUses(event.target.value); setError(null); }} />
        </FormField>
        <FormField label="Uses per organization" htmlFor="promo-org-limit" required>
          <Input id="promo-org-limit" type="number" min={1} required value={maxUsesPerOrg} onChange={(event) => { setMaxUsesPerOrg(event.target.value); setError(null); }} />
        </FormField>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={!dirty || saving}>
          <Save className="mr-2 h-4 w-4" />
          Save changes
        </Button>
      </div>
    </form>
  );
}
