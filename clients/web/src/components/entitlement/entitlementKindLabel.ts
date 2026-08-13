import { ENTITLEMENT_KINDS } from "@/lib/api/entitlement/entitlementTypes";

/** `resource_kind` arrives as a free string from the wire; an unknown kind is
 *  shown verbatim rather than rendering a raw message key. */
export function entitlementKindLabel(
  t: (key: string) => string,
  kind: string,
): string {
  return (ENTITLEMENT_KINDS as readonly string[]).includes(kind)
    ? t(`kind.${kind}`)
    : kind;
}
