"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/page-header";
import { createPromoCode } from "@/lib/api/admin/promo";
import type { CreateAdminPromoCodeInput } from "@/lib/api/admin/promoTypes";
import { getErrorMessage } from "@/lib/utils";
import { CreatePromoCodeForm } from "./CreatePromoCodeForm";

export default function CreatePromoCodePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const create = async (input: CreateAdminPromoCodeInput) => {
    setSaving(true);
    try {
      const code = await createPromoCode(input);
      toast.success("Promo code created.");
      router.push(`/admin/promo-codes/${code.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create promo code."));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        breadcrumb={
          <Link
            href="/admin/promo-codes"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Promo codes
          </Link>
        }
        title="Create promo code"
        subtitle="Issue a subscription plan extension with explicit usage and time limits."
      />
      <CreatePromoCodeForm saving={saving} onSubmit={create} />
    </div>
  );
}
