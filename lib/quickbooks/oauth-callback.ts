// intuit-oauth 4.x still uses an older CommonJS query-string decoder. Its patched
// dependency is ESM-only, so overriding it would break token exchange. Keep raw
// external query strings out of that decoder: bound, parse natively and encode
// only the token-exchange fields. URLSearchParams produces valid UTF-8 escapes.
export function oauthCallbackForTokenExchange(uri: string) {
  if (uri.length > 4096) throw new Error("OAuth callback is too long.");
  const url = new URL(uri);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid OAuth callback URL.");
  const safe = new URLSearchParams();
  for (const [name, limit] of [["code", 2048], ["realmId", 128], ["state", 512]] as const) {
    const values = url.searchParams.getAll(name);
    if (values.length > 1 || (!values.length && name !== "state") || (values[0]?.length ?? 0) > limit)
      throw new Error("Invalid OAuth callback fields.");
    if (values.length) safe.set(name, values[0]);
  }
  // Never pass an untrusted redirectUri override or unrelated query fields.
  return `${url.origin}${url.pathname}?${safe.toString()}`;
}
