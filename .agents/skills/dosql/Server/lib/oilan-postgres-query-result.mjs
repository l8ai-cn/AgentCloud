import { OILAN_POSTGRES } from "./oilan-postgres-doops-registration.mjs";

const OILAN_TARGETING_LINE = [
  "[TARGETING] Server: gw-oilan-node",
  "(https://doops.l8ai.cn -> doops-oilan/oilan-node),",
  "Use: doops-oilan/oilan-node via gateway",
].join(" ");

export const OILAN_DOOPS_ROUTE = Object.freeze({
  targetName: "gw-oilan-node",
  gateway: "https://doops.l8ai.cn",
  cluster: "doops-oilan",
  instance: "oilan-node",
});

export function parseOilanPostgresDoopsResult(queryName, stdout) {
  const rows = parseOilanDoopsRows(stdout);
  if (rows.length !== 1) {
    throw new Error("Oilan PostgreSQL query must return exactly one result row");
  }
  return {
    doopsRoute: OILAN_DOOPS_ROUTE,
    result: parseOilanPostgresQueryResult(queryName, rows[0]),
  };
}

export function parseOilanDoopsRows(stdout) {
  const lines = resultLines(stdout);
  if (lines[0] !== OILAN_TARGETING_LINE) {
    throw new Error("DoOps did not prove the canonical Oilan target route");
  }
  return lines.slice(1);
}

export function parseOilanPostgresQueryResult(queryName, line) {
  const fields = line.split("|");

  if (queryName === "asset-probe") {
    requireFieldCount(fields, 2, queryName);
    const [databaseName, serverVersionNum] = fields;
    if (databaseName !== OILAN_POSTGRES.databaseName) {
      throw new Error("Oilan PostgreSQL probe returned the wrong database");
    }
    if (!/^[1-9][0-9]{4,5}$/.test(serverVersionNum)) {
      throw new Error("Oilan PostgreSQL probe returned an invalid server version");
    }
    return { databaseName, serverVersionNum };
  }

  if (queryName === "schema-fingerprint") {
    requireFieldCount(fields, 3, queryName);
    const [countText, usersText, orgsText] = fields;
    if (!/^[1-9][0-9]*$/.test(countText)) {
      throw new Error("Oilan PostgreSQL public table count is invalid");
    }
    if (usersText !== "t") {
      throw new Error("Oilan PostgreSQL users table is missing");
    }
    if (orgsText !== "t") {
      throw new Error("Oilan PostgreSQL organizations table is missing");
    }
    return {
      publicTableCount: Number(countText),
      usersPresent: true,
      organizationsPresent: true,
    };
  }

  if (queryName === "bundle-temperature-audit") {
    requireFieldCount(fields, 4, queryName);
    const [countText, namesText, bindingsText, variablesText] = fields;
    if (!/^(?:0|[1-9][0-9]*)$/.test(countText)) {
      throw new Error("Oilan PostgreSQL config bundle count is invalid");
    }
    if (!/^[a-z0-9,-]*$/.test(namesText)) {
      throw new Error("Oilan PostgreSQL config bundle names are invalid");
    }
    if (!/^[a-z0-9,=.+-]*$/.test(bindingsText)) {
      throw new Error("Oilan PostgreSQL config bundle temperatures are invalid");
    }
    if (!/^[A-Za-z0-9,._-]*$/.test(variablesText)) {
      throw new Error("Oilan PostgreSQL temperature variable names are invalid");
    }
    return {
      configBundleCount: Number(countText),
      configBundleNames: splitList(namesText),
      temperatureBindings: splitList(bindingsText),
      temperatureVariables: splitList(variablesText),
    };
  }

  throw new Error(`unsupported Oilan PostgreSQL query result: ${queryName}`);
}

export function assertOilanPostgresQueryResult(queryName, result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Oilan PostgreSQL result must be an object");
  }
  if (queryName === "asset-probe") {
    const parsed = parseOilanPostgresQueryResult(
      queryName,
      `${result.databaseName}|${result.serverVersionNum}`,
    );
    if (Object.keys(result).sort().join(",") !== Object.keys(parsed).sort().join(",")) {
      throw new Error("Oilan PostgreSQL probe result has unexpected fields");
    }
    return true;
  }
  if (queryName === "schema-fingerprint") {
    const users = result.usersPresent === true ? "t" : "";
    const orgs = result.organizationsPresent === true ? "t" : "";
    const parsed = parseOilanPostgresQueryResult(
      queryName,
      `${result.publicTableCount}|${users}|${orgs}`,
    );
    if (Object.keys(result).sort().join(",") !== Object.keys(parsed).sort().join(",")) {
      throw new Error("Oilan PostgreSQL schema fingerprint has unexpected fields");
    }
    return true;
  }
  if (queryName === "bundle-temperature-audit") {
    const parsed = parseOilanPostgresQueryResult(
      queryName,
      [
        result.configBundleCount,
        joinList(result.configBundleNames),
        joinList(result.temperatureBindings),
        joinList(result.temperatureVariables),
      ].join("|"),
    );
    if (Object.keys(result).sort().join(",") !== Object.keys(parsed).sort().join(",")) {
      throw new Error("Oilan PostgreSQL config bundle audit has unexpected fields");
    }
    return true;
  }
  throw new Error(`unsupported Oilan PostgreSQL query result: ${queryName}`);
}

export function assertOilanDoopsRoute(route) {
  for (const [key, value] of Object.entries(OILAN_DOOPS_ROUTE)) {
    if (route?.[key] !== value) {
      throw new Error("DoOps route does not match the canonical Oilan target");
    }
  }
  if (Object.keys(route).sort().join(",") !== Object.keys(OILAN_DOOPS_ROUTE).sort().join(",")) {
    throw new Error("DoOps route has unexpected fields");
  }
  return true;
}

function resultLines(stdout) {
  return String(stdout ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitList(text) {
  return text ? text.split(",") : [];
}

function joinList(values) {
  if (!Array.isArray(values)) {
    throw new Error("Oilan PostgreSQL config bundle audit expects string lists");
  }
  return values.join(",");
}

function requireFieldCount(fields, expected, queryName) {
  if (fields.length !== expected) {
    throw new Error(`Oilan PostgreSQL ${queryName} result shape is invalid`);
  }
}
