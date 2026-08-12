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
  // Agent settings documents live in config-kind bundles as a JSON body under
  // the reserved __json key. Sampling model parameters is what makes a
  // provider-side "only 1 is allowed for this model" rejection explainable, so
  // this query reports bundle identities, config temperature values, and the
  // key names of temperature-shaped variables in other bundle kinds — never a
  // document body or a non-config value, which may carry operator secrets.
  "bundle-temperature-audit": [
    "with settings as (select name, (data->>'__json')::jsonb as body",
    "from env_bundles where kind = 'config' and is_active),",
    "variables as (select name, key from env_bundles,",
    "jsonb_object_keys(data) as key",
    "where kind <> 'config' and is_active and key ilike '%temperature%')",
    "select (select count(*)::int from settings),",
    "coalesce((select string_agg(distinct name, ',' order by name)",
    "from settings), ''),",
    "coalesce((select string_agg(distinct name || '=' || (value #>> '{}'), ',')",
    "from settings, jsonb_path_query(body, '$.**.temperature') as value), ''),",
    "coalesce((select string_agg(distinct name || '.' || key, ',')",
    "from variables), '');",
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
