export function modelBindingNameForResourceId(resourceId: number): string {
  if (!Number.isSafeInteger(resourceId) || resourceId <= 0) {
    throw new Error("Model resource ID must be a positive integer.");
  }
  return `model-${resourceId}`;
}

export function resourceIdFromModelBindingName(
  name: string | undefined,
): number | undefined {
  if (!name) return undefined;
  const match = /^model-([1-9]\d*)$/.exec(name);
  if (!match) return undefined;
  const resourceId = Number(match[1]);
  return Number.isSafeInteger(resourceId) ? resourceId : undefined;
}
