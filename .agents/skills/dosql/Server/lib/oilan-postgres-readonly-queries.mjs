export const OILAN_POSTGRES_QUERIES = Object.freeze({
  "asset-probe": [
    "select current_database(),",
    "current_setting('server_version_num');",
  ].join(" "),
  "schema-fingerprint": [
    "select",
    "(select count(*)::int from information_schema.tables",
    "where table_schema = 'public' and table_type = 'BASE TABLE'),",
    "exists (select 1 from information_schema.tables",
    "where table_schema = 'public' and table_name = 'users'),",
    "exists (select 1 from information_schema.tables",
    "where table_schema = 'public' and table_name = 'organizations');",
  ].join(" "),
});

export function resolveOilanPostgresQuery(queryName) {
  const name = requiredText(queryName, "queryName");
  const sql = OILAN_POSTGRES_QUERIES[name];
  if (!sql) {
    throw new Error(`unsupported Oilan PostgreSQL read-only query: ${name}`);
  }
  return { name, sql };
}

function requiredText(value, fieldName) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  if (!text) throw new Error(`${fieldName} is required`);
  return text;
}
