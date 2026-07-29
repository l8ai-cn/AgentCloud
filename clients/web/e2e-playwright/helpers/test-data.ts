/**
 * Centralized test data constants and factory functions.
 * Generates unique names to avoid collisions in parallel/repeated runs.
 */

let counter = 0;

/** Generate a unique suffix for test entities. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${++counter}`;
}

/** Generate a unique test email address. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${uniqueSuffix()}@test.local`;
}

/** Common cleanup SQL fragments. */
export const CLEANUP = {
  /** Delete a user and their org memberships by email. */
  userByEmail: (email: string) => `
    DELETE FROM organization_members WHERE user_id IN (SELECT id FROM users WHERE email = '${email}');
    DELETE FROM users WHERE email = '${email}';
  `.trim(),

  /** Delete a user, their orgs (via membership), and memberships by email. */
  userAndOrgsByEmail: (email: string) => `
    DELETE FROM organizations WHERE id IN (
      SELECT om.organization_id FROM organization_members om
      JOIN users u ON om.user_id = u.id WHERE u.email = '${email}'
    );
    DELETE FROM users WHERE email = '${email}';
  `.trim(),
} as const;

/** Password hash for 'password123' (bcrypt, used in test user inserts). */
export const HASH_PASSWORD123 =
  "$2a$10$moG8vXzlCj2cegPB4yPlkenKD8ztwo6Vfh7mIAR8nVMToxG5Ai5Bm";

/** Plaintext that matches HASH_PASSWORD123 — use for login after DB seed. */
export const PASSWORD123 = "password123";

/** Insert a verified local password user. Local Register RPC is closed. */
export function seedPasswordUserSQL(opts: {
  email: string;
  username: string;
  name?: string;
}): string {
  const name = (opts.name ?? opts.username).replace(/'/g, "''");
  const email = opts.email.replace(/'/g, "''");
  const username = opts.username.replace(/'/g, "''");
  return `
    INSERT INTO users (email, username, password_hash, name, is_email_verified, created_at, updated_at)
    VALUES ('${email}', '${username}', '${HASH_PASSWORD123}', '${name}', true, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      username = EXCLUDED.username,
      password_hash = EXCLUDED.password_hash,
      name = EXCLUDED.name,
      is_email_verified = true,
      updated_at = NOW()
  `.trim();
}

/** Password hash for 'AdminAb123456' (bcrypt, matches dev seed data). */
export const HASH_DEV_PASSWORD =
  "$2a$10$k4P3AdDi0j4XT1VeDt4YuOFcxfj2uDbm8N9Tj7fCK0Gk/PY3Gz1WC";

/** @deprecated Use HASH_DEV_PASSWORD */
export const HASH_DEVPASS123 = HASH_DEV_PASSWORD;

/** Build a structured MessageContent object for sending channel messages. */
export function textContent(text: string) {
  return {
    kind: "text",
    blocks: [{ type: "paragraph", elements: [{ type: "text", text }] }],
  };
}
