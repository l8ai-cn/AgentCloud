export function hostFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, init);
}
