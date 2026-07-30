"use client";

import { useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CreateAdminPromoCodeInput,
  PromoCodeType,
} from "@/lib/api/admin/promoTypes";
import { promoTypeLabels } from "../promoCodePresentation";

interface CreatePromoCodeFormProps {
  saving: boolean;
  onSubmit: (input: CreateAdminPromoCodeInput) => Promise<void>;
}

interface FormState {
  code: string;
  name: string;
  description: string;
  type: PromoCodeType;
  planName: "pro" | "enterprise";
  durationMonths: string;
  maxUses: string;
  maxUsesPerOrg: string;
  startsAt: string;
  expiresAt: string;
}

const initialState: FormState = {
  code: "",
  name: "",
  description: "",
  type: "campaign",
  planName: "pro",
  durationMonths: "1",
  maxUses: "",
  maxUsesPerOrg: "1",
  startsAt: "",
  expiresAt: "",
};

function positiveInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

export function CreatePromoCodeForm({
  saving,
  onSubmit,
}: CreatePromoCodeFormProps) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const startsAt = form.startsAt
        ? new Date(form.startsAt).toISOString()
        : undefined;
      const expiresAt = form.expiresAt
        ? new Date(form.expiresAt).toISOString()
        : undefined;
      if (startsAt && expiresAt && expiresAt <= startsAt) {
        throw new Error("Expiration must be after the start time.");
      }
      await onSubmit({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        plan_name: form.planName,
        duration_months: positiveInteger(form.durationMonths, "Duration"),
        max_uses: form.maxUses
          ? positiveInteger(form.maxUses, "Maximum uses")
          : undefined,
        max_uses_per_org: positiveInteger(
          form.maxUsesPerOrg,
          "Uses per organization",
        ),
        starts_at: startsAt,
        expires_at: expiresAt,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create promo code.",
      );
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-md border border-border bg-surface-raised p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Code" htmlFor="promo-code" required hint="Stored in uppercase; maximum 50 characters.">
          <Input id="promo-code" required maxLength={50} value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} className="font-mono uppercase" />
        </FormField>
        <FormField label="Name" htmlFor="promo-name" required>
          <Input id="promo-name" required maxLength={100} value={form.name} onChange={(event) => set("name", event.target.value)} />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="promo-description">
        <Textarea id="promo-description" rows={3} value={form.description} onChange={(event) => set("description", event.target.value)} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Type" required>
          <Select value={form.type} onValueChange={(value) => set("type", value)}>
            <SelectTrigger aria-label="Promo code type">{promoTypeLabels[form.type]}</SelectTrigger>
            <SelectContent>
              {Object.entries(promoTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Plan" required>
          <Select value={form.planName} onValueChange={(value) => set("planName", value)}>
            <SelectTrigger aria-label="Subscription plan">{form.planName === "pro" ? "Pro" : "Enterprise"}</SelectTrigger>
            <SelectContent>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Duration (months)" htmlFor="promo-duration" required>
          <Input id="promo-duration" type="number" min={1} required value={form.durationMonths} onChange={(event) => set("durationMonths", event.target.value)} />
        </FormField>
        <FormField label="Total use limit" htmlFor="promo-max-uses" hint="Leave blank for unlimited.">
          <Input id="promo-max-uses" type="number" min={1} value={form.maxUses} onChange={(event) => set("maxUses", event.target.value)} />
        </FormField>
        <FormField label="Uses per organization" htmlFor="promo-org-limit" required>
          <Input id="promo-org-limit" type="number" min={1} required value={form.maxUsesPerOrg} onChange={(event) => set("maxUsesPerOrg", event.target.value)} />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Starts at" htmlFor="promo-starts" hint="Leave blank to start immediately.">
          <Input id="promo-starts" type="datetime-local" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} />
        </FormField>
        <FormField label="Expires at" htmlFor="promo-expires" hint="Leave blank for no expiration.">
          <Input id="promo-expires" type="datetime-local" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} />
        </FormField>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          <Save className="mr-2 h-4 w-4" />
          Create promo code
        </Button>
      </div>
    </form>
  );
}
