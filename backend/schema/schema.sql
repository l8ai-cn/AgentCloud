--
-- Consolidated schema snapshot of the authoritative database.
--
-- 这个文件是数据库的投影，不是变更来源。结构变更只通过 DoSql 直接作用于目标库，
-- 然后重新导出覆盖本文件；禁止手改本文件，也禁止把它当迁移链使用。
-- 唯一用途：给全新的 dev/CI 空库建 schema。导出命令见 backend/schema/README.md.
--
-- 2026-07-30: dropped organization_agents, organization_agent_configs, ssh_keys,
-- schema_migrations, marketplace_schema_migrations; dropped git_providers.ssh_key_id.
--

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14 (Debian 16.14-1.pgdg12+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: marketplace; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA marketplace;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: sso_protocol; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sso_protocol AS ENUM (
    'oidc',
    'saml',
    'ldap'
);


--
-- Name: assert_listing_is_publishable(bigint); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.assert_listing_is_publishable(target_listing_id bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM marketplace.marketplace_listings
        WHERE id = target_listing_id AND status = 'published'
    ) AND NOT EXISTS (
        SELECT 1
        FROM marketplace.marketplace_listings l
        JOIN marketplace.marketplace_listing_versions lv
          ON lv.id = l.current_version_id AND lv.listing_id = l.id
        JOIN marketplace.marketplace_catalog_item_versions civ
          ON civ.id = lv.catalog_item_version_id
        WHERE l.id = target_listing_id
          AND lv.review_status = 'approved'
          AND civ.validation_status = 'passed'
    ) THEN
        RAISE EXCEPTION 'published listing requires approved validated versions';
    END IF;
    IF EXISTS (
        SELECT 1 FROM marketplace.marketplace_listings
        WHERE id = target_listing_id AND status = 'published'
    ) AND NOT EXISTS (
        SELECT 1
        FROM marketplace.marketplace_listing_spaces ls
        JOIN marketplace.marketplace_spaces s ON s.id = ls.space_id
        WHERE ls.listing_id = target_listing_id
          AND ls.is_primary
          AND s.status = 'published'
    ) THEN
        RAISE EXCEPTION 'published listing requires a published primary space';
    END IF;
END;
$$;


--
-- Name: enforce_quota_non_negative_balance(); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.enforce_quota_non_negative_balance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    available_balance NUMERIC(20,6);
    reserved_balance NUMERIC(20,6);
BEGIN
    PERFORM 1
    FROM marketplace.marketplace_quota_accounts
    WHERE marketplace_id = NEW.marketplace_id AND id = NEW.quota_account_id
    FOR UPDATE;

    SELECT
        COALESCE(SUM(available_delta), 0) + NEW.available_delta,
        COALESCE(SUM(reserved_delta), 0) + NEW.reserved_delta
    INTO available_balance, reserved_balance
    FROM marketplace.marketplace_quota_ledger_entries
    WHERE quota_account_id = NEW.quota_account_id;

    IF available_balance < 0 OR reserved_balance < 0 THEN
        RAISE EXCEPTION 'quota balance cannot be negative';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: prevent_catalog_version_payload_update(); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.prevent_catalog_version_payload_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'catalog item versions are immutable';
    END IF;
    IF (NEW.catalog_item_id, NEW.version, NEW.source_revision, NEW.content_digest,
        NEW.manifest, NEW.permissions, NEW.compatibility, NEW.dependency_lock,
        NEW.artifact_key, NEW.created_by_platform_user_id, NEW.created_at)
        IS DISTINCT FROM
       (OLD.catalog_item_id, OLD.version, OLD.source_revision, OLD.content_digest,
        OLD.manifest, OLD.permissions, OLD.compatibility, OLD.dependency_lock,
        OLD.artifact_key, OLD.created_by_platform_user_id, OLD.created_at) THEN
        RAISE EXCEPTION 'catalog item version payload is immutable';
    END IF;
    IF NOT (
        NEW.validation_status = OLD.validation_status
        OR (OLD.validation_status = 'pending' AND NEW.validation_status IN ('passed', 'failed'))
    ) THEN
        RAISE EXCEPTION 'invalid catalog validation transition';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: prevent_quota_ledger_mutation(); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.prevent_quota_ledger_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'quota ledger entries are immutable';
END;
$$;


--
-- Name: prevent_submitted_listing_version_update(); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.prevent_submitted_listing_version_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.review_status <> 'draft' THEN
            RAISE EXCEPTION 'submitted listing versions are immutable';
        END IF;
        RETURN OLD;
    END IF;
    IF (OLD.review_status <> 'draft' OR NEW.review_status <> 'draft') AND
       (NEW.listing_id, NEW.catalog_item_id, NEW.catalog_item_version_id, NEW.revision,
        NEW.display_name, NEW.tagline, NEW.description, NEW.outcomes, NEW.use_cases,
        NEW.target_audience, NEW.requirements, NEW.tags, NEW.quota_plan_id,
        NEW.release_notes, NEW.created_at)
       IS DISTINCT FROM
       (OLD.listing_id, OLD.catalog_item_id, OLD.catalog_item_version_id, OLD.revision,
        OLD.display_name, OLD.tagline, OLD.description, OLD.outcomes, OLD.use_cases,
        OLD.target_audience, OLD.requirements, OLD.tags, OLD.quota_plan_id,
        OLD.release_notes, OLD.created_at) THEN
        RAISE EXCEPTION 'submitted listing version payload is immutable';
    END IF;
    IF NOT (
        NEW.review_status = OLD.review_status
        OR (OLD.review_status = 'draft' AND NEW.review_status = 'submitted')
        OR (OLD.review_status = 'submitted' AND NEW.review_status IN ('approved', 'rejected'))
    ) THEN
        RAISE EXCEPTION 'invalid listing review transition';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validate_expert_runtime_compatibility(); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.validate_expert_runtime_compatibility() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
    IF NEW.status = 'published' AND EXISTS (
        SELECT 1
        FROM marketplace.marketplace_listing_versions lv
        JOIN marketplace.marketplace_catalog_items ci
          ON ci.id = lv.catalog_item_id
        JOIN marketplace.marketplace_catalog_item_versions civ
          ON civ.id = lv.catalog_item_version_id
        WHERE lv.id = NEW.current_version_id
          AND lv.listing_id = NEW.id
          AND ci.platform_resource_type = 'expert'
          AND NOT (
              COALESCE(civ.compatibility->'agents'->>0, '')
                  ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
              AND char_length(civ.compatibility->'agents'->>0)
                  BETWEEN 2 AND 100
          )
    ) THEN
        RAISE EXCEPTION 'published expert listing requires a valid compatible agent identifier';
    END IF;
    RETURN NEW;
END;
$_$;


--
-- Name: validate_listing_publication(); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.validate_listing_publication() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'marketplace_listings' THEN
        PERFORM marketplace.assert_listing_is_publishable(NEW.id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM marketplace.assert_listing_is_publishable(OLD.listing_id);
    ELSE
        PERFORM marketplace.assert_listing_is_publishable(NEW.listing_id);
        IF OLD.listing_id IS DISTINCT FROM NEW.listing_id THEN
            PERFORM marketplace.assert_listing_is_publishable(OLD.listing_id);
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validate_space_publication(); Type: FUNCTION; Schema: marketplace; Owner: -
--

CREATE FUNCTION marketplace.validate_space_publication() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM marketplace.assert_listing_is_publishable(ls.listing_id)
    FROM marketplace.marketplace_listing_spaces ls
    WHERE ls.space_id = NEW.id AND ls.is_primary;
    RETURN NEW;
END;
$$;


--
-- Name: enforce_model_resource_default(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_model_resource_default() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    resource_owner_scope VARCHAR(16);
    resource_owner_id BIGINT;
    resource_modalities JSONB;
BEGIN
    SELECT connection.owner_scope, connection.owner_id, resource.modalities
      INTO resource_owner_scope, resource_owner_id, resource_modalities
      FROM model_resources resource
      JOIN provider_connections connection ON connection.id = resource.provider_connection_id
     WHERE resource.id = NEW.model_resource_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'model resource % does not exist', NEW.model_resource_id;
    END IF;
    IF resource_owner_scope <> NEW.owner_scope OR resource_owner_id <> NEW.owner_id THEN
        RAISE EXCEPTION 'model resource default owner does not match connection owner';
    END IF;
    IF NOT (resource_modalities ? NEW.modality) THEN
        RAISE EXCEPTION 'model resource % does not support modality %', NEW.model_resource_id, NEW.modality;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: enforce_provider_connection_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_provider_connection_owner() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.owner_scope = 'user' THEN
        PERFORM 1 FROM users WHERE id = NEW.owner_id FOR KEY SHARE;
    ELSE
        PERFORM 1 FROM organizations WHERE id = NEW.owner_id FOR KEY SHARE;
    END IF;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'provider connection % owner % does not exist', NEW.owner_scope, NEW.owner_id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: guard_orchestration_resource_plan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_orchestration_resource_plan() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.consumed_at IS NOT NULL OR NEW.consumed_by_id IS NOT NULL
            OR NEW.consumption_result IS NOT NULL OR NEW.result_resource_id IS NOT NULL OR NEW.result_resource_uid IS NOT NULL
            OR NEW.result_resource_version IS NOT NULL OR NEW.result_revision IS NOT NULL OR NEW.result_json IS NOT NULL THEN
            RAISE EXCEPTION 'orchestration resource plans must be inserted pending';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        IF pg_trigger_depth() > 1 AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id) THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'orchestration resource plans cannot be deleted';
    END IF;
    IF OLD.consumed_at IS NOT NULL THEN
        RAISE EXCEPTION 'orchestration resource plans can only be consumed once';
    END IF;
    IF (NEW.id, NEW.organization_id, NEW.actor_id, NEW.target_resource_id, NEW.target_api_version,
        NEW.target_kind, NEW.target_namespace, NEW.target_name, NEW.operation, NEW.base_head_uid,
        NEW.base_resource_version, NEW.draft_hash, NEW.plan_hash, NEW.canonical_manifest,
        NEW.resolved_refs, NEW.semantic_diff, NEW.issues, NEW.artifact_kind, NEW.artifact_json,
        NEW.artifact_digest, NEW.options_revision, NEW.created_at, NEW.expires_at) IS DISTINCT FROM
       (OLD.id, OLD.organization_id, OLD.actor_id, OLD.target_resource_id, OLD.target_api_version,
        OLD.target_kind, OLD.target_namespace, OLD.target_name, OLD.operation, OLD.base_head_uid,
        OLD.base_resource_version, OLD.draft_hash, OLD.plan_hash, OLD.canonical_manifest,
        OLD.resolved_refs, OLD.semantic_diff, OLD.issues, OLD.artifact_kind, OLD.artifact_json,
        OLD.artifact_digest, OLD.options_revision, OLD.created_at, OLD.expires_at) THEN
        RAISE EXCEPTION 'orchestration resource plan payload is immutable';
    END IF;
    IF NEW.consumed_at IS NULL OR NEW.consumed_by_id IS NULL OR NEW.consumption_result IS NULL OR NEW.result_json IS NULL THEN
        RAISE EXCEPTION 'orchestration resource plan consumption must be atomic';
    END IF;
    IF NEW.consumption_result = 'applied' AND OLD.operation = 'update'
        AND NOT EXISTS (SELECT 1 FROM orchestration_resources WHERE organization_id = OLD.organization_id
            AND id = OLD.target_resource_id AND uid = OLD.base_head_uid AND resource_version = OLD.base_resource_version) THEN
        RAISE EXCEPTION 'orchestration resource plan is stale';
    END IF;
    IF NEW.consumption_result = 'applied' AND OLD.operation = 'create'
        AND EXISTS (SELECT 1 FROM orchestration_resources WHERE organization_id = OLD.organization_id
            AND api_version = OLD.target_api_version AND kind = OLD.target_kind
            AND namespace = OLD.target_namespace AND name = OLD.target_name) THEN
        RAISE EXCEPTION 'orchestration resource plan target already exists';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: keep_ai_resource_parent_invariants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.keep_ai_resource_parent_invariants() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'provider_connections' THEN
        IF NEW.owner_scope <> OLD.owner_scope OR NEW.owner_id <> OLD.owner_id THEN
            RAISE EXCEPTION 'provider connection owner is immutable';
        END IF;
    ELSE
        IF NEW.provider_connection_id <> OLD.provider_connection_id THEN
            RAISE EXCEPTION 'model resource connection is immutable';
        END IF;
        IF EXISTS (
            SELECT 1 FROM model_resource_defaults defaults
             WHERE defaults.model_resource_id = OLD.id
               AND NOT (NEW.modalities ? defaults.modality)
        ) THEN
            RAISE EXCEPTION 'cannot remove a modality with an active default';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: keep_orchestration_resource_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.keep_orchestration_resource_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (NEW.id, NEW.organization_id, NEW.uid, NEW.api_version, NEW.kind, NEW.namespace,
        NEW.name, NEW.created_by_id, NEW.created_at) IS DISTINCT FROM
       (OLD.id, OLD.organization_id, OLD.uid, OLD.api_version, OLD.kind, OLD.namespace,
        OLD.name, OLD.created_by_id, OLD.created_at) THEN
        RAISE EXCEPTION 'orchestration resource ownership, identity, and uid are immutable';
    END IF;
    IF NEW.resource_version <> OLD.resource_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
        RAISE EXCEPTION 'orchestration resource version and timestamp must advance exactly once';
    END IF;
    IF NEW.active_revision = OLD.active_revision THEN
        IF NEW.generation <> OLD.generation OR (NEW.display_name, NEW.labels) IS DISTINCT FROM (OLD.display_name, OLD.labels) THEN
            RAISE EXCEPTION 'status-only updates cannot change desired resource state';
        END IF;
    ELSIF NEW.active_revision <> OLD.active_revision + 1 OR NEW.generation NOT IN (OLD.generation, OLD.generation + 1) THEN
        RAISE EXCEPTION 'orchestration resource revision and generation must advance exactly once';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: orchestration_identifier_valid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.orchestration_identifier_valid(value text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$ SELECT
    value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(value) BETWEEN 2 AND 100 AND value NOT IN ('about','admin','agents','api','app','auth','billing','blog','careers','changelog','dashboard','demo','docs','enterprise','false','forgot-password','invite','login','logout','me','mock-checkout','new','null','offline','onboarding','organizations','orgs','personal','popout',
     'privacy','register','reset-password','runners','settings','support','terms','true','undefined','verify-email','www') $_$;


--
-- Name: prevent_agent_workbench_append_only_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_agent_workbench_append_only_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE'
        AND pg_trigger_depth() > 1
        AND NOT EXISTS (
            SELECT 1 FROM agent_sessions WHERE id = OLD.session_id
        )
    THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;


--
-- Name: prevent_ai_resource_owner_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_ai_resource_owner_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleting_scope VARCHAR(16);
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        deleting_scope := 'user';
    ELSE
        deleting_scope := 'org';
    END IF;
    IF EXISTS (
        SELECT 1 FROM provider_connections
         WHERE owner_scope = deleting_scope AND owner_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'cannot delete % % with provider connections', deleting_scope, OLD.id;
    END IF;
    RETURN OLD;
END;
$$;


--
-- Name: prevent_expert_market_release_immutable_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_expert_market_release_immutable_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.application_id IS DISTINCT FROM OLD.application_id
    OR NEW.source_expert_id IS DISTINCT FROM OLD.source_expert_id
    OR NEW.publisher_organization_id IS DISTINCT FROM OLD.publisher_organization_id
    OR NEW.publisher_user_id IS DISTINCT FROM OLD.publisher_user_id
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.name IS DISTINCT FROM OLD.name
    OR NEW.summary IS DISTINCT FROM OLD.summary
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.icon IS DISTINCT FROM OLD.icon
    OR NEW.tags IS DISTINCT FROM OLD.tags
    OR NEW.outcomes IS DISTINCT FROM OLD.outcomes
    OR NEW.featured IS DISTINCT FROM OLD.featured
    OR NEW.expert_snapshot IS DISTINCT FROM OLD.expert_snapshot
    OR NEW.worker_spec_snapshot IS DISTINCT FROM OLD.worker_spec_snapshot
    OR NEW.skill_dependencies IS DISTINCT FROM OLD.skill_dependencies
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'expert market release immutable fields cannot be updated';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_orchestration_resource_revision_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_orchestration_resource_revision_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1
        AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'orchestration resource revisions are immutable';
END;
$$;


--
-- Name: prevent_worker_spec_dependency_artifact_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_worker_spec_dependency_artifact_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'worker_spec_dependency_artifacts are immutable';
END;
$$;


--
-- Name: prevent_worker_spec_snapshot_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_worker_spec_snapshot_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'worker_spec_snapshots are immutable';
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: validate_expert_market_application_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_expert_market_application_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM 1
  FROM experts
  WHERE id = NEW.source_expert_id
    AND organization_id = NEW.publisher_organization_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source expert must belong to the publisher organization'
      USING ERRCODE = '23503',
        CONSTRAINT = 'expert_market_applications_source_expert_publisher';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_expert_market_release_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_expert_market_release_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM 1
  FROM experts
  WHERE id = NEW.source_expert_id
    AND organization_id = NEW.publisher_organization_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source expert must belong to the publisher organization'
      USING ERRCODE = '23503',
        CONSTRAINT = 'expert_market_releases_source_expert_publisher';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_orchestration_resource_revision_link(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_orchestration_resource_revision_link() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE linked_revision BIGINT; linked_generation BIGINT; linked_version BIGINT; previous_spec JSONB; active_spec JSONB;
BEGIN
    IF TG_TABLE_NAME = 'orchestration_resources' THEN
        SELECT generation, resource_version INTO linked_generation, linked_version FROM orchestration_resource_revisions
        WHERE resource_id = NEW.id AND revision = NEW.active_revision;
        IF NOT FOUND OR linked_generation <> NEW.generation OR linked_version > NEW.resource_version
            OR (TG_OP = 'INSERT' AND linked_version <> NEW.resource_version)
            OR (TG_OP = 'UPDATE' AND NEW.active_revision <> OLD.active_revision
                AND linked_version <> NEW.resource_version) THEN
            RAISE EXCEPTION 'orchestration resource head does not match its active revision';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.active_revision <> OLD.active_revision THEN
            SELECT previous.canonical_spec, active.canonical_spec INTO previous_spec, active_spec
            FROM orchestration_resource_revisions previous, orchestration_resource_revisions active
            WHERE previous.resource_id = NEW.id AND previous.revision = OLD.active_revision
                AND active.resource_id = NEW.id AND active.revision = NEW.active_revision;
            IF NOT FOUND OR (active_spec IS DISTINCT FROM previous_spec) <> (NEW.generation = OLD.generation + 1) THEN
                RAISE EXCEPTION 'orchestration resource generation does not match spec change';
            END IF;
        END IF;
    ELSE
        SELECT active_revision, generation, resource_version INTO linked_revision, linked_generation, linked_version
        FROM orchestration_resources WHERE id = NEW.resource_id AND organization_id = NEW.organization_id;
        IF NOT FOUND OR linked_revision <> NEW.revision OR linked_generation <> NEW.generation
            OR linked_version <> NEW.resource_version THEN
            RAISE EXCEPTION 'orchestration resource revision does not match its head';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: worker_spec_jsonb_is_positive_int64(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.worker_spec_jsonb_is_positive_int64(value jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    SELECT CASE
        WHEN value IS NULL OR jsonb_typeof(value) <> 'number' THEN FALSE
        WHEN value::TEXT !~ '^[1-9][0-9]*$' THEN FALSE
        WHEN length(value::TEXT) < 19 THEN TRUE
        WHEN length(value::TEXT) = 19
            THEN value::TEXT <= '9223372036854775807'
        ELSE FALSE
    END
$_$;


--
-- Name: worker_spec_model_binding_is_valid(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.worker_spec_model_binding_is_valid(binding jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    SELECT CASE
        WHEN binding = '{}'::JSONB THEN TRUE
        WHEN binding IS NULL OR jsonb_typeof(binding) <> 'object' THEN FALSE
        WHEN NOT (
            binding ?& ARRAY[
                'resource_id',
                'resource_revision',
                'connection_id',
                'connection_revision',
                'provider_key',
                'model_id'
            ]
        ) THEN FALSE
        WHEN binding - ARRAY[
            'resource_id',
            'resource_revision',
            'connection_id',
            'connection_revision',
            'provider_key',
            'protocol_adapter',
            'model_id'
        ]::TEXT[] <> '{}'::JSONB THEN FALSE
        ELSE
            worker_spec_jsonb_is_positive_int64(binding->'resource_id')
            AND worker_spec_jsonb_is_positive_int64(binding->'resource_revision')
            AND worker_spec_jsonb_is_positive_int64(binding->'connection_id')
            AND worker_spec_jsonb_is_positive_int64(binding->'connection_revision')
            AND jsonb_typeof(binding->'provider_key') = 'string'
            AND char_length(binding->>'provider_key') BETWEEN 2 AND 100
            AND binding->>'provider_key' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
            AND (
                NOT binding ? 'protocol_adapter'
                OR (
                    jsonb_typeof(binding->'protocol_adapter') = 'string'
                    AND char_length(binding->>'protocol_adapter') BETWEEN 2 AND 100
                    AND binding->>'protocol_adapter' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                )
            )
            AND jsonb_typeof(binding->'model_id') = 'string'
            AND btrim(binding->>'model_id') <> ''
    END
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: marketplace_audit_events; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_audit_events (
    id uuid NOT NULL,
    marketplace_id bigint NOT NULL,
    actor_platform_user_id bigint,
    action character varying(100) NOT NULL,
    target_type character varying(100) NOT NULL,
    target_ref character varying(100) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketplace_catalog_item_versions; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_catalog_item_versions (
    id bigint NOT NULL,
    catalog_item_id bigint NOT NULL,
    version character varying(50) NOT NULL,
    source_revision character varying(100) NOT NULL,
    content_digest character(64) NOT NULL,
    manifest jsonb NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    compatibility jsonb DEFAULT '{}'::jsonb NOT NULL,
    dependency_lock jsonb DEFAULT '{}'::jsonb NOT NULL,
    artifact_key character varying(500),
    validation_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_by_platform_user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_catalog_item_versions_validation_status_check CHECK (((validation_status)::text = ANY ((ARRAY['pending'::character varying, 'passed'::character varying, 'failed'::character varying, 'deprecated'::character varying])::text[])))
);


--
-- Name: marketplace_catalog_item_versions_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_catalog_item_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_catalog_item_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_catalog_item_versions_id_seq OWNED BY marketplace.marketplace_catalog_item_versions.id;


--
-- Name: marketplace_catalog_items; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_catalog_items (
    id bigint NOT NULL,
    publisher_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    resource_type character varying(20) NOT NULL,
    name character varying(120) NOT NULL,
    summary character varying(240) NOT NULL,
    platform_resource_type character varying(40) NOT NULL,
    platform_resource_id bigint,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    latest_version_id bigint,
    created_by_platform_user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    CONSTRAINT marketplace_catalog_items_resource_type_check CHECK (((resource_type)::text = ANY ((ARRAY['application'::character varying, 'skill'::character varying, 'mcp_connector'::character varying, 'resource'::character varying])::text[]))),
    CONSTRAINT marketplace_catalog_items_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT marketplace_catalog_items_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'deprecated'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: marketplace_catalog_items_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_catalog_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_catalog_items_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_catalog_items_id_seq OWNED BY marketplace.marketplace_catalog_items.id;


--
-- Name: marketplace_domains; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_domains (
    id bigint NOT NULL,
    marketplace_id bigint NOT NULL,
    host character varying(253) NOT NULL,
    kind character varying(16) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    verification_token character varying(100) NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    last_error_code character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_domains_host_check CHECK (((host)::text = lower((host)::text))),
    CONSTRAINT marketplace_domains_kind_check CHECK (((kind)::text = ANY ((ARRAY['platform'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT marketplace_domains_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'verifying'::character varying, 'active'::character varying, 'failed'::character varying, 'disabled'::character varying])::text[])))
);


--
-- Name: marketplace_domains_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_domains_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_domains_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_domains_id_seq OWNED BY marketplace.marketplace_domains.id;


--
-- Name: marketplace_entitlements; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_entitlements (
    id uuid NOT NULL,
    marketplace_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    subject_type character varying(16) NOT NULL,
    subject_platform_id bigint NOT NULL,
    target_platform_org_id bigint NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    source character varying(16) NOT NULL,
    source_request_id uuid,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    granted_by_platform_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_entitlements_check CHECK (((expires_at IS NULL) OR (expires_at > starts_at))),
    CONSTRAINT marketplace_entitlements_source_check CHECK (((source)::text = ANY ((ARRAY['direct'::character varying, 'approval'::character varying, 'grant'::character varying])::text[]))),
    CONSTRAINT marketplace_entitlements_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'revoked'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT marketplace_entitlements_subject_type_check CHECK (((subject_type)::text = ANY ((ARRAY['user'::character varying, 'organization'::character varying])::text[])))
);


--
-- Name: marketplace_installation_operations; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_installation_operations (
    id uuid NOT NULL,
    marketplace_id bigint NOT NULL,
    installation_id uuid NOT NULL,
    operation_type character varying(16) NOT NULL,
    idempotency_key uuid NOT NULL,
    status character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    stage character varying(40) NOT NULL,
    plan jsonb NOT NULL,
    result jsonb,
    error_code character varying(80),
    error_message character varying(500),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_installation_operations_operation_type_check CHECK (((operation_type)::text = ANY ((ARRAY['install'::character varying, 'upgrade'::character varying, 'suspend'::character varying, 'resume'::character varying, 'uninstall'::character varying])::text[]))),
    CONSTRAINT marketplace_installation_operations_stage_check CHECK (((stage)::text = ANY ((ARRAY['entitlement'::character varying, 'quota'::character varying, 'runtime'::character varying, 'dependencies'::character varying, 'create'::character varying, 'verify'::character varying, 'settle'::character varying])::text[]))),
    CONSTRAINT marketplace_installation_operations_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'running'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'compensating'::character varying, 'compensated'::character varying])::text[])))
);


--
-- Name: marketplace_installations; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_installations (
    id uuid NOT NULL,
    marketplace_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    listing_version_id bigint NOT NULL,
    entitlement_id uuid NOT NULL,
    target_platform_org_id bigint NOT NULL,
    quota_charge_scope character varying(16) NOT NULL,
    quota_account_id uuid,
    installed_by_platform_user_id bigint NOT NULL,
    status character varying(20) DEFAULT 'planning'::character varying NOT NULL,
    runtime_ref character varying(200),
    config_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    plan_digest character(64) NOT NULL,
    current_operation_id uuid,
    last_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_installations_check CHECK (((((quota_charge_scope)::text = 'user'::text) AND (quota_account_id IS NULL)) OR (((quota_charge_scope)::text <> 'user'::text) AND (quota_account_id IS NOT NULL)))),
    CONSTRAINT marketplace_installations_plan_digest_check CHECK ((plan_digest ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT marketplace_installations_quota_charge_scope_check CHECK (((quota_charge_scope)::text = ANY ((ARRAY['marketplace'::character varying, 'organization'::character varying, 'group'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT marketplace_installations_status_check CHECK (((status)::text = ANY ((ARRAY['planning'::character varying, 'installing'::character varying, 'verifying'::character varying, 'active'::character varying, 'failed'::character varying, 'suspended'::character varying, 'uninstalled'::character varying])::text[])))
);


--
-- Name: marketplace_listing_spaces; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_listing_spaces (
    marketplace_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    space_id bigint NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: marketplace_listing_version_tags; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_listing_version_tags (
    marketplace_id bigint NOT NULL,
    listing_id bigint NOT NULL,
    listing_version_id bigint NOT NULL,
    taxonomy_tag_id bigint NOT NULL
);


--
-- Name: marketplace_listing_versions; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_listing_versions (
    id bigint NOT NULL,
    listing_id bigint NOT NULL,
    catalog_item_version_id bigint NOT NULL,
    revision integer NOT NULL,
    display_name character varying(120) NOT NULL,
    tagline character varying(160) NOT NULL,
    description text NOT NULL,
    outcomes jsonb DEFAULT '[]'::jsonb NOT NULL,
    use_cases jsonb DEFAULT '[]'::jsonb NOT NULL,
    target_audience jsonb DEFAULT '[]'::jsonb NOT NULL,
    requirements jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    quota_plan_id bigint,
    release_notes text DEFAULT ''::text NOT NULL,
    review_status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    catalog_item_id bigint NOT NULL,
    CONSTRAINT marketplace_listing_versions_review_status_check CHECK (((review_status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT marketplace_listing_versions_revision_check CHECK ((revision > 0))
);


--
-- Name: marketplace_listing_versions_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_listing_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_listing_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_listing_versions_id_seq OWNED BY marketplace.marketplace_listing_versions.id;


--
-- Name: marketplace_listings; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_listings (
    id bigint NOT NULL,
    marketplace_id bigint NOT NULL,
    catalog_item_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    visibility character varying(16) DEFAULT 'hidden'::character varying NOT NULL,
    access_mode character varying(16) DEFAULT 'direct'::character varying NOT NULL,
    current_version_id bigint,
    submitted_by_platform_user_id bigint,
    published_at timestamp with time zone,
    suspended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    featured_rank integer DEFAULT 0 NOT NULL,
    CONSTRAINT marketplace_listings_access_mode_check CHECK (((access_mode)::text = ANY ((ARRAY['direct'::character varying, 'approval'::character varying, 'grant_only'::character varying])::text[]))),
    CONSTRAINT marketplace_listings_check CHECK ((((status)::text <> 'published'::text) OR ((current_version_id IS NOT NULL) AND (published_at IS NOT NULL)))),
    CONSTRAINT marketplace_listings_featured_rank_check CHECK ((featured_rank >= 0)),
    CONSTRAINT marketplace_listings_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT marketplace_listings_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'validating'::character varying, 'needs_changes'::character varying, 'approved'::character varying, 'published'::character varying, 'suspended'::character varying, 'deprecated'::character varying, 'removed'::character varying])::text[]))),
    CONSTRAINT marketplace_listings_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['public'::character varying, 'members'::character varying, 'hidden'::character varying])::text[])))
);


--
-- Name: marketplace_listings_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_listings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_listings_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_listings_id_seq OWNED BY marketplace.marketplace_listings.id;


--
-- Name: marketplace_publishers; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_publishers (
    id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    publisher_type character varying(16) NOT NULL,
    platform_user_id bigint,
    platform_org_id bigint,
    display_name character varying(120) NOT NULL,
    summary character varying(240),
    logo_asset_key character varying(500),
    verification_status character varying(20) DEFAULT 'unverified'::character varying NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_publishers_check CHECK (((((publisher_type)::text = 'user'::text) AND (platform_user_id IS NOT NULL) AND (platform_org_id IS NULL)) OR (((publisher_type)::text = 'organization'::text) AND (platform_user_id IS NULL) AND (platform_org_id IS NOT NULL)) OR (((publisher_type)::text = 'platform'::text) AND (platform_user_id IS NULL) AND (platform_org_id IS NULL)))),
    CONSTRAINT marketplace_publishers_publisher_type_check CHECK (((publisher_type)::text = ANY ((ARRAY['user'::character varying, 'organization'::character varying, 'platform'::character varying])::text[]))),
    CONSTRAINT marketplace_publishers_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT marketplace_publishers_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['unverified'::character varying, 'pending'::character varying, 'verified'::character varying, 'revoked'::character varying])::text[])))
);


--
-- Name: marketplace_publishers_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_publishers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_publishers_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_publishers_id_seq OWNED BY marketplace.marketplace_publishers.id;


--
-- Name: marketplace_quota_accounts; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_quota_accounts (
    id uuid NOT NULL,
    marketplace_id bigint NOT NULL,
    subject_type character varying(16) NOT NULL,
    subject_ref bigint NOT NULL,
    quota_plan_id bigint NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_quota_accounts_check CHECK ((period_end > period_start)),
    CONSTRAINT marketplace_quota_accounts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT marketplace_quota_accounts_subject_ref_check CHECK ((subject_ref > 0)),
    CONSTRAINT marketplace_quota_accounts_subject_type_check CHECK (((subject_type)::text = ANY ((ARRAY['marketplace'::character varying, 'organization'::character varying, 'group'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: marketplace_quota_ledger_entries; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_quota_ledger_entries (
    id uuid NOT NULL,
    marketplace_id bigint NOT NULL,
    quota_account_id uuid NOT NULL,
    entry_type character varying(20) NOT NULL,
    available_delta numeric(20,6) DEFAULT 0 NOT NULL,
    reserved_delta numeric(20,6) DEFAULT 0 NOT NULL,
    consumed_delta numeric(20,6) DEFAULT 0 NOT NULL,
    shortfall_delta numeric(20,6) DEFAULT 0 NOT NULL,
    reservation_id uuid,
    usage_event_id uuid,
    operation_id uuid,
    period_start timestamp with time zone,
    reason character varying(240) NOT NULL,
    created_by_platform_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_quota_ledger_entries_check CHECK ((((entry_type)::text <> 'grant'::text) OR (period_start IS NOT NULL))),
    CONSTRAINT marketplace_quota_ledger_entries_consumed_delta_check CHECK ((consumed_delta >= (0)::numeric)),
    CONSTRAINT marketplace_quota_ledger_entries_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['grant'::character varying, 'reserve'::character varying, 'debit'::character varying, 'release'::character varying, 'adjust'::character varying, 'grant_expire'::character varying])::text[]))),
    CONSTRAINT marketplace_quota_ledger_entries_shortfall_delta_check CHECK ((shortfall_delta >= (0)::numeric))
);


--
-- Name: marketplace_quota_plans; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_quota_plans (
    id bigint NOT NULL,
    marketplace_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    period character varying(16) NOT NULL,
    grant_credits numeric(20,6) NOT NULL,
    charge_scope character varying(16) NOT NULL,
    renewal_day smallint,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_quota_plans_charge_scope_check CHECK (((charge_scope)::text = ANY ((ARRAY['marketplace'::character varying, 'organization'::character varying, 'group'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT marketplace_quota_plans_check CHECK (((((period)::text = 'monthly'::text) AND ((renewal_day >= 1) AND (renewal_day <= 28))) OR (((period)::text = 'total'::text) AND (renewal_day IS NULL)))),
    CONSTRAINT marketplace_quota_plans_grant_credits_check CHECK ((grant_credits >= (0)::numeric)),
    CONSTRAINT marketplace_quota_plans_period_check CHECK (((period)::text = ANY ((ARRAY['monthly'::character varying, 'total'::character varying])::text[]))),
    CONSTRAINT marketplace_quota_plans_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT marketplace_quota_plans_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'retired'::character varying])::text[])))
);


--
-- Name: marketplace_quota_plans_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_quota_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_quota_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_quota_plans_id_seq OWNED BY marketplace.marketplace_quota_plans.id;


--
-- Name: marketplace_quota_reservations; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_quota_reservations (
    id uuid NOT NULL,
    marketplace_id bigint NOT NULL,
    quota_account_id uuid NOT NULL,
    reservation_type character varying(20) NOT NULL,
    subject_ref character varying(100) NOT NULL,
    idempotency_key uuid NOT NULL,
    reserved_credits numeric(20,6) NOT NULL,
    status character varying(16) DEFAULT 'held'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_quota_reservations_reservation_type_check CHECK (((reservation_type)::text = ANY ((ARRAY['installation'::character varying, 'runtime_execution'::character varying])::text[]))),
    CONSTRAINT marketplace_quota_reservations_reserved_credits_check CHECK ((reserved_credits > (0)::numeric)),
    CONSTRAINT marketplace_quota_reservations_status_check CHECK (((status)::text = ANY ((ARRAY['held'::character varying, 'settled'::character varying, 'released'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: marketplace_spaces; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_spaces (
    id bigint NOT NULL,
    marketplace_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(80) NOT NULL,
    summary character varying(240) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    icon_asset_key character varying(500),
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by_platform_user_id bigint NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    CONSTRAINT marketplace_spaces_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT marketplace_spaces_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'hidden'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: marketplace_spaces_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_spaces_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_spaces_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_spaces_id_seq OWNED BY marketplace.marketplace_spaces.id;


--
-- Name: marketplace_taxonomy_tags; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplace_taxonomy_tags (
    id bigint NOT NULL,
    marketplace_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    display_name text NOT NULL,
    kind character varying(20) NOT NULL,
    parent_tag_id bigint,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_taxonomy_tags_check CHECK (((parent_tag_id IS NULL) OR (parent_tag_id <> id))),
    CONSTRAINT marketplace_taxonomy_tags_display_name_check CHECK ((char_length(display_name) > 0)),
    CONSTRAINT marketplace_taxonomy_tags_kind_check CHECK (((kind)::text = ANY ((ARRAY['scene'::character varying, 'industry'::character varying, 'audience'::character varying, 'capability'::character varying, 'integration'::character varying, 'readiness'::character varying])::text[]))),
    CONSTRAINT marketplace_taxonomy_tags_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100))))
);


--
-- Name: marketplace_taxonomy_tags_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplace_taxonomy_tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplace_taxonomy_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplace_taxonomy_tags_id_seq OWNED BY marketplace.marketplace_taxonomy_tags.id;


--
-- Name: marketplaces; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.marketplaces (
    id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(120) NOT NULL,
    summary character varying(240) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    visibility character varying(16) DEFAULT 'private'::character varying NOT NULL,
    template_key character varying(50) DEFAULT 'blank'::character varying NOT NULL,
    default_locale character varying(16) DEFAULT 'zh-CN'::character varying NOT NULL,
    registration_mode character varying(16) DEFAULT 'invite'::character varying NOT NULL,
    owner_platform_org_id bigint NOT NULL,
    default_quota_plan_id bigint,
    created_by_platform_user_id bigint NOT NULL,
    published_at timestamp with time zone,
    suspended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    CONSTRAINT marketplaces_registration_mode_check CHECK (((registration_mode)::text = ANY ((ARRAY['public'::character varying, 'invite'::character varying, 'sso'::character varying])::text[]))),
    CONSTRAINT marketplaces_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT marketplaces_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'configuring'::character varying, 'review'::character varying, 'published'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT marketplaces_template_key_check CHECK (((template_key)::text = ANY ((ARRAY['blank'::character varying, 'cross-border-commerce'::character varying, 'higher-education'::character varying, 'enterprise'::character varying])::text[]))),
    CONSTRAINT marketplaces_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying])::text[])))
);


--
-- Name: marketplaces_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.marketplaces_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketplaces_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.marketplaces_id_seq OWNED BY marketplace.marketplaces.id;


--
-- Name: agent_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_sessions (
    id character varying(100) NOT NULL,
    organization_id bigint NOT NULL,
    user_id bigint NOT NULL,
    pod_key character varying(100) NOT NULL,
    agent_slug character varying(50) NOT NULL,
    runner_node_id character varying(100),
    title text,
    status character varying(20) DEFAULT 'idle'::character varying NOT NULL,
    parent_session_id character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project text,
    archived boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    mcp_servers jsonb DEFAULT '[]'::jsonb NOT NULL,
    codex_goal jsonb,
    CONSTRAINT agent_sessions_id_check CHECK ((((id)::text ~ '^conv_[a-z0-9]+$'::text) AND ((char_length((id)::text) >= 8) AND (char_length((id)::text) <= 100))))
);


--
-- Name: agent_workbench_command_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_workbench_command_receipts (
    session_id character varying(100) NOT NULL,
    command_id character varying(100) NOT NULL,
    payload_digest character varying(71) NOT NULL,
    state smallint NOT NULL,
    receipt bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_workbench_command_receipts_command_id_check CHECK ((((command_id)::text = btrim((command_id)::text)) AND ((char_length((command_id)::text) >= 1) AND (char_length((command_id)::text) <= 100)))),
    CONSTRAINT agent_workbench_command_receipts_payload_digest_check CHECK (((payload_digest)::text ~ '^sha256:[0-9a-f]{64}$'::text)),
    CONSTRAINT agent_workbench_command_receipts_state_check CHECK (((state >= 1) AND (state <= 7)))
);


--
-- Name: agent_workbench_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_workbench_events (
    session_id character varying(100) NOT NULL,
    stream_epoch character varying(100) NOT NULL,
    sequence numeric(20,0) NOT NULL,
    revision numeric(20,0) NOT NULL,
    payload bytea NOT NULL,
    digest character varying(71) NOT NULL,
    causation_command_id character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_workbench_events_causation_command_id_check CHECK (((causation_command_id IS NULL) OR (((causation_command_id)::text = btrim((causation_command_id)::text)) AND ((char_length((causation_command_id)::text) >= 1) AND (char_length((causation_command_id)::text) <= 100))))),
    CONSTRAINT agent_workbench_events_digest_check CHECK (((digest)::text ~ '^sha256:[0-9a-f]{64}$'::text)),
    CONSTRAINT agent_workbench_events_revision_check CHECK (((revision >= (1)::numeric) AND (revision <= '18446744073709551615'::numeric))),
    CONSTRAINT agent_workbench_events_sequence_check CHECK (((sequence >= (1)::numeric) AND (sequence <= '18446744073709551615'::numeric))),
    CONSTRAINT agent_workbench_events_stream_epoch_check CHECK ((((stream_epoch)::text = btrim((stream_epoch)::text)) AND ((char_length((stream_epoch)::text) >= 1) AND (char_length((stream_epoch)::text) <= 100))))
);


--
-- Name: agent_workbench_session_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_workbench_session_states (
    session_id character varying(100) NOT NULL,
    stream_epoch character varying(100) NOT NULL,
    revision numeric(20,0) NOT NULL,
    latest_sequence numeric(20,0) NOT NULL,
    projection bytea NOT NULL,
    digest character varying(71) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_workbench_session_states_digest_check CHECK (((digest)::text ~ '^sha256:[0-9a-f]{64}$'::text)),
    CONSTRAINT agent_workbench_session_states_latest_sequence_check CHECK (((latest_sequence >= (0)::numeric) AND (latest_sequence <= '18446744073709551615'::numeric))),
    CONSTRAINT agent_workbench_session_states_revision_check CHECK (((revision >= (0)::numeric) AND (revision <= '18446744073709551615'::numeric))),
    CONSTRAINT agent_workbench_session_states_stream_epoch_check CHECK ((((stream_epoch)::text = btrim((stream_epoch)::text)) AND ((char_length((stream_epoch)::text) >= 1) AND (char_length((stream_epoch)::text) <= 100))))
);


--
-- Name: agent_workbench_source_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_workbench_source_events (
    session_id character varying(100) NOT NULL,
    stable_event_id character varying(200) NOT NULL,
    runner_session_epoch character varying(100) NOT NULL,
    source_sequence numeric(20,0) NOT NULL,
    payload_digest character varying(71) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_workbench_source_events_payload_digest_check CHECK (((payload_digest)::text ~ '^sha256:[0-9a-f]{64}$'::text)),
    CONSTRAINT agent_workbench_source_events_runner_session_epoch_check CHECK ((((runner_session_epoch)::text = btrim((runner_session_epoch)::text)) AND ((char_length((runner_session_epoch)::text) >= 1) AND (char_length((runner_session_epoch)::text) <= 100)))),
    CONSTRAINT agent_workbench_source_events_source_sequence_check CHECK (((source_sequence >= (1)::numeric) AND (source_sequence <= '18446744073709551615'::numeric))),
    CONSTRAINT agent_workbench_source_events_stable_event_id_check CHECK ((((stable_event_id)::text = btrim((stable_event_id)::text)) AND ((char_length((stable_event_id)::text) >= 1) AND (char_length((stable_event_id)::text) <= 200))))
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    slug character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    launch_command character varying(500) NOT NULL,
    default_args text,
    is_builtin boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    executable character varying(100),
    supported_modes character varying(50) DEFAULT 'pty'::character varying NOT NULL,
    agentfile_source text,
    uses_legacy_columns boolean DEFAULT false NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    adapter_id character varying(100) NOT NULL,
    CONSTRAINT agents_adapter_id_check CHECK ((((adapter_id)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((adapter_id)::text) >= 2) AND (char_length((adapter_id)::text) <= 100)))),
    CONSTRAINT agents_slug_format CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100))))
);


--
-- Name: COLUMN agents.is_internal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.is_internal IS 'When true, the agent is excluded from the user-facing list (ListBuiltinActive). Used to mark e2e/test fixtures so they cannot accidentally surface in production UIs.';


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id bigint NOT NULL,
    organization_id bigint,
    user_id bigint,
    name character varying(100) NOT NULL,
    provider_type character varying(50) NOT NULL,
    model character varying(200) NOT NULL,
    base_url character varying(500) DEFAULT ''::character varying NOT NULL,
    encrypted_credentials text DEFAULT ''::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    token_budget bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_models_scope_ck CHECK (((organization_id IS NOT NULL) OR (user_id IS NOT NULL)))
);


--
-- Name: ai_models_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_models_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_models_id_seq OWNED BY public.ai_models.id;


--
-- Name: ai_resource_migration_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_resource_migration_map (
    id bigint NOT NULL,
    source_kind character varying(32) NOT NULL,
    source_id bigint NOT NULL,
    provider_connection_id bigint,
    model_resource_id bigint,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    error_message text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_resource_migration_map_source_id_check CHECK ((source_id > 0)),
    CONSTRAINT ai_resource_migration_map_source_kind_check CHECK (((source_kind)::text = ANY ((ARRAY['ai_model'::character varying, 'env_bundle'::character varying])::text[]))),
    CONSTRAINT ai_resource_migration_map_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'migrated'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: ai_resource_migration_map_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_resource_migration_map_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_resource_migration_map_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_resource_migration_map_id_seq OWNED BY public.ai_resource_migration_map.id;


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    key_prefix character varying(12) NOT NULL,
    key_hash character varying(128) NOT NULL,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    expires_at timestamp without time zone,
    last_used_at timestamp without time zone,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    slug character varying(100) NOT NULL,
    CONSTRAINT api_keys_slug_format CHECK (((slug IS NULL) OR (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))))
);


--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    organization_id bigint,
    actor_id bigint,
    actor_type character varying(50) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id bigint,
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id bigint NOT NULL,
    organization_id bigint,
    slug character varying(100) NOT NULL,
    display_name character varying(255) DEFAULT ''::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    license character varying(100) DEFAULT ''::character varying NOT NULL,
    git_repo_path character varying(255) NOT NULL,
    default_branch character varying(255) DEFAULT 'main'::character varying NOT NULL,
    http_clone_url character varying(1000),
    install_source character varying(20) DEFAULT 'gitops'::character varying NOT NULL,
    content_sha character varying(64) DEFAULT ''::character varying NOT NULL,
    storage_key character varying(500) DEFAULT ''::character varying NOT NULL,
    package_size bigint DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category character varying(50) DEFAULT ''::character varying NOT NULL,
    compatibility character varying(500) DEFAULT ''::character varying NOT NULL,
    allowed_tools text DEFAULT ''::text NOT NULL,
    agent_filter jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    upstream_url character varying(500) DEFAULT ''::character varying NOT NULL,
    upstream_subdir character varying(255) DEFAULT ''::character varying NOT NULL,
    upstream_commit_sha character varying(40) DEFAULT ''::character varying NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT authored_skills_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100))))
);


--
-- Name: TABLE skills; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.skills IS 'Unified skill catalog. Git is the source of truth (one am-skills repo per skill); rows index the packaged artifact (content_sha/storage_key) plus upstream provenance for imported skills.';


--
-- Name: COLUMN skills.git_repo_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skills.git_repo_path IS 'am-skills/org<ID>-<slug>.';


--
-- Name: COLUMN skills.install_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skills.install_source IS 'Provenance marker for the authoring source (always ''gitops'' for this table).';


--
-- Name: COLUMN skills.upstream_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skills.upstream_url IS 'External git repo this skill was imported from (empty for platform-authored skills).';


--
-- Name: COLUMN skills.upstream_subdir; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skills.upstream_subdir IS 'Subdirectory inside upstream_url holding this skill (empty when the repo root is the skill).';


--
-- Name: authored_skills_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.authored_skills_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: authored_skills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.authored_skills_id_seq OWNED BY public.skills.id;


--
-- Name: autopilot_controllers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autopilot_controllers (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    autopilot_controller_key character varying(100) NOT NULL,
    pod_key character varying(100) NOT NULL,
    pod_id bigint NOT NULL,
    runner_id bigint NOT NULL,
    prompt text,
    phase character varying(50) DEFAULT 'initializing'::character varying NOT NULL,
    current_iteration integer DEFAULT 0 NOT NULL,
    max_iterations integer DEFAULT 10 NOT NULL,
    iteration_timeout_sec integer DEFAULT 300 NOT NULL,
    circuit_breaker_state character varying(50) DEFAULT 'closed'::character varying NOT NULL,
    circuit_breaker_reason character varying(500),
    no_progress_threshold integer DEFAULT 3 NOT NULL,
    same_error_threshold integer DEFAULT 5 NOT NULL,
    approval_timeout_min integer DEFAULT 30 NOT NULL,
    control_agent_slug character varying(50),
    control_prompt_template text,
    mcp_config_json text,
    user_takeover boolean DEFAULT false NOT NULL,
    started_at timestamp with time zone,
    last_iteration_at timestamp with time zone,
    completed_at timestamp with time zone,
    approval_request_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE autopilot_controllers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.autopilot_controllers IS 'Autopilot controllers for supervised Pod automation';


--
-- Name: autopilot_iterations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autopilot_iterations (
    id bigint NOT NULL,
    autopilot_controller_id bigint NOT NULL,
    iteration integer NOT NULL,
    phase character varying(50) NOT NULL,
    summary text,
    files_changed text,
    error_message text,
    duration_ms bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE autopilot_iterations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.autopilot_iterations IS 'Iteration history for Autopilot execution tracking';


--
-- Name: block_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_embeddings (
    block_id uuid NOT NULL,
    model text NOT NULL,
    dims integer NOT NULL,
    vector jsonb NOT NULL,
    source_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vec public.vector(256)
);


--
-- Name: block_ops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_ops (
    id bigint NOT NULL,
    workspace_id uuid NOT NULL,
    idempotency_key character varying(128),
    actor_type character varying(16) NOT NULL,
    actor_id bigint NOT NULL,
    op character varying(32) NOT NULL,
    target_block uuid,
    target_ref bigint,
    payload jsonb NOT NULL,
    forward jsonb NOT NULL,
    inverse jsonb NOT NULL,
    parent_op_id bigint,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT block_ops_target_exclusive CHECK ((((target_block IS NOT NULL) AND (target_ref IS NULL)) OR ((target_block IS NULL) AND (target_ref IS NOT NULL))))
);


--
-- Name: block_ops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.block_ops_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: block_ops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.block_ops_id_seq OWNED BY public.block_ops.id;


--
-- Name: block_refs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_refs (
    id bigint NOT NULL,
    workspace_id uuid NOT NULL,
    from_id uuid NOT NULL,
    to_id uuid NOT NULL,
    rel character varying(64) NOT NULL,
    order_key text,
    anchor text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: block_refs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.block_refs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: block_refs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.block_refs_id_seq OWNED BY public.block_refs.id;


--
-- Name: block_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_workspaces (
    id uuid NOT NULL,
    organization_id bigint NOT NULL,
    slug character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    root_block_id uuid,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    type character varying(64) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    text text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, COALESCE(text, ''::text))) STORED
);


--
-- Name: channel_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_access (
    id bigint NOT NULL,
    channel_id bigint NOT NULL,
    pod_key character varying(100),
    user_id bigint,
    last_access timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_access_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_access_id_seq OWNED BY public.channel_access.id;


--
-- Name: channel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_members (
    channel_id bigint NOT NULL,
    user_id bigint NOT NULL,
    is_muted boolean DEFAULT false,
    joined_at timestamp with time zone DEFAULT now(),
    role character varying(20) DEFAULT 'member'::character varying NOT NULL
);


--
-- Name: channel_message_edits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_message_edits (
    id bigint NOT NULL,
    message_id bigint NOT NULL,
    editor_user_id bigint,
    editor_pod character varying(100),
    previous_body text NOT NULL,
    previous_content jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_message_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_message_edits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_message_edits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_message_edits_id_seq OWNED BY public.channel_message_edits.id;


--
-- Name: channel_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_messages (
    id bigint NOT NULL,
    channel_id bigint NOT NULL,
    sender_pod character varying(100),
    sender_user_id bigint,
    message_type character varying(50) DEFAULT 'text'::character varying NOT NULL,
    body text NOT NULL,
    content jsonb,
    mentions jsonb DEFAULT '{}'::jsonb,
    reply_to bigint,
    edited_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL
);


--
-- Name: channel_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_messages_id_seq OWNED BY public.channel_messages.id;


--
-- Name: channel_pods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_pods (
    id bigint NOT NULL,
    channel_id bigint NOT NULL,
    pod_key character varying(100) NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_pods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_pods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_pods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_pods_id_seq OWNED BY public.channel_pods.id;


--
-- Name: channel_read_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_read_states (
    channel_id bigint NOT NULL,
    user_id bigint NOT NULL,
    last_read_message_id bigint,
    last_read_at timestamp with time zone DEFAULT now()
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    document text,
    repository_id bigint,
    ticket_id bigint,
    created_by_pod character varying(100),
    created_by_user_id bigint,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_config jsonb,
    visibility character varying(10) DEFAULT 'public'::character varying NOT NULL,
    slug character varying(100) NOT NULL,
    CONSTRAINT channels_slug_format CHECK (((slug IS NULL) OR (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))))
);


--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: conversation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_items (
    id character varying(100) NOT NULL,
    session_id character varying(100) NOT NULL,
    item_type character varying(50) NOT NULL,
    response_id character varying(100) DEFAULT ''::character varying NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    "position" bigint NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_items_id_check CHECK ((((id)::text ~ '^item_[a-z0-9]+$'::text) AND ((char_length((id)::text) >= 8) AND (char_length((id)::text) <= 100))))
);


--
-- Name: coordinator_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coordinator_executions (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    project_id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    pod_id bigint,
    pod_key character varying(100),
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    stage character varying(64),
    claim_marker text,
    external_id character varying(255),
    summary text,
    feedback_status character varying(32),
    error text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coordinator_executions_feedback_status_check CHECK (((feedback_status IS NULL) OR ((feedback_status)::text = ANY ((ARRAY['pending'::character varying, 'posted'::character varying, 'failed'::character varying])::text[])))),
    CONSTRAINT coordinator_executions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'claimed'::character varying, 'running'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'feedback_failed'::character varying])::text[])))
);


--
-- Name: TABLE coordinator_executions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.coordinator_executions IS 'One claim→dispatch→feedback cycle, linking a coordinator project to its ticket and the pod that ran it.';


--
-- Name: coordinator_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coordinator_executions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coordinator_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coordinator_executions_id_seq OWNED BY public.coordinator_executions.id;


--
-- Name: coordinator_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coordinator_projects (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    repository_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    platform_type character varying(32) DEFAULT 'cnb'::character varying NOT NULL,
    source_type character varying(32) DEFAULT 'issues'::character varying NOT NULL,
    label_filter text[] DEFAULT '{}'::text[] NOT NULL,
    claim_policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    agent_slug character varying(100) DEFAULT 'do-agent'::character varying NOT NULL,
    scan_interval_seconds integer DEFAULT 300 NOT NULL,
    max_concurrent integer DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_by_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    worker_spec_snapshot_id bigint,
    CONSTRAINT coordinator_projects_agent_slug_check CHECK ((((agent_slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((agent_slug)::text) >= 2) AND (char_length((agent_slug)::text) <= 100)))),
    CONSTRAINT coordinator_projects_max_concurrent_check CHECK ((max_concurrent > 0)),
    CONSTRAINT coordinator_projects_platform_type_check CHECK (((platform_type)::text = ANY ((ARRAY['cnb'::character varying, 'linear'::character varying])::text[]))),
    CONSTRAINT coordinator_projects_scan_interval_seconds_check CHECK ((scan_interval_seconds > 0)),
    CONSTRAINT coordinator_projects_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT coordinator_projects_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['issues'::character varying, 'pulls'::character varying])::text[]))),
    CONSTRAINT coordinator_projects_worker_spec_snapshot_positive CHECK (((worker_spec_snapshot_id IS NULL) OR (worker_spec_snapshot_id > 0)))
);


--
-- Name: TABLE coordinator_projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.coordinator_projects IS 'Org-scoped auto-harness coordinator config: one repository, a claim policy, and a dispatch agent.';


--
-- Name: COLUMN coordinator_projects.worker_spec_snapshot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coordinator_projects.worker_spec_snapshot_id IS 'Required immutable worker spec snapshot. NULL legacy projects are disabled until an audited binding is applied.';


--
-- Name: coordinator_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coordinator_projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coordinator_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coordinator_projects_id_seq OWNED BY public.coordinator_projects.id;


--
-- Name: custom_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_agents (
    organization_id bigint NOT NULL,
    slug character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    launch_command character varying(500) NOT NULL,
    default_args text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agentfile_source text,
    CONSTRAINT custom_agents_slug_format CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100))))
);


--
-- Name: env_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.env_bundles (
    id bigint NOT NULL,
    owner_scope character varying(16) NOT NULL,
    owner_id bigint NOT NULL,
    agent_slug character varying(100),
    name character varying(100) NOT NULL,
    description text,
    kind character varying(32) NOT NULL,
    kind_primary boolean DEFAULT false NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE env_bundles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.env_bundles IS 'Named, owner-scoped sets of environment variables referenced from AgentFile via USE_ENV_BUNDLE. credential-kind values are encrypted at the service layer; other kinds are plaintext.';


--
-- Name: COLUMN env_bundles.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.env_bundles.kind IS 'String, code-layer defined (no enum constraint): credential / runtime / shared / etc.';


--
-- Name: COLUMN env_bundles.kind_primary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.env_bundles.kind_primary IS 'True for the user''s default bundle in this (owner, agent_slug, kind) group. UI hint only — backend does NOT auto-mount based on this flag; AgentFile USE_ENV_BUNDLE controls injection.';


--
-- Name: env_bundles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.env_bundles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: env_bundles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.env_bundles_id_seq OWNED BY public.env_bundles.id;


--
-- Name: execution_clusters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_clusters (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    kind character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT execution_clusters_kind_check CHECK (((kind)::text = ANY ((ARRAY['online'::character varying, 'local'::character varying])::text[]))),
    CONSTRAINT execution_clusters_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT execution_clusters_status_check CHECK (((status)::text = ANY ((ARRAY['ready'::character varying, 'pending'::character varying, 'offline'::character varying])::text[])))
);


--
-- Name: execution_clusters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.execution_clusters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_clusters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.execution_clusters_id_seq OWNED BY public.execution_clusters.id;


--
-- Name: expert_market_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expert_market_applications (
    id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    publisher_organization_id bigint NOT NULL,
    source_expert_id bigint NOT NULL,
    publisher_user_id bigint NOT NULL,
    is_operator_owned boolean DEFAULT false NOT NULL,
    latest_published_release_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expert_market_applications_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100))))
);


--
-- Name: expert_market_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expert_market_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expert_market_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expert_market_applications_id_seq OWNED BY public.expert_market_applications.id;


--
-- Name: expert_market_releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expert_market_releases (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    source_expert_id bigint NOT NULL,
    publisher_organization_id bigint NOT NULL,
    publisher_user_id bigint NOT NULL,
    version integer NOT NULL,
    status character varying(32) NOT NULL,
    name character varying(255) NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    category character varying(100) DEFAULT ''::character varying NOT NULL,
    icon character varying(100) DEFAULT ''::character varying NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    outcomes text[] DEFAULT '{}'::text[] NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    expert_snapshot jsonb NOT NULL,
    worker_spec_snapshot jsonb NOT NULL,
    skill_dependencies jsonb NOT NULL,
    reviewer_user_id bigint,
    rejection_reason text,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    published_at timestamp with time zone,
    rejected_at timestamp with time zone,
    withdrawn_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expert_market_releases_expert_snapshot_check CHECK (((jsonb_typeof(expert_snapshot) = 'object'::text) AND COALESCE((jsonb_typeof((expert_snapshot -> 'version'::text)) = 'number'::text), false) AND ((expert_snapshot ->> 'version'::text) ~ '^[1-9][0-9]*$'::text) AND (((expert_snapshot ->> 'version'::text))::numeric <= ('9223372036854775807'::bigint)::numeric))),
    CONSTRAINT expert_market_releases_skill_dependencies_check CHECK ((jsonb_typeof(skill_dependencies) = 'array'::text)),
    CONSTRAINT expert_market_releases_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'published'::character varying, 'rejected'::character varying, 'withdrawn'::character varying])::text[]))),
    CONSTRAINT expert_market_releases_version_check CHECK ((version > 0)),
    CONSTRAINT expert_market_releases_worker_spec_snapshot_check CHECK (((jsonb_typeof(worker_spec_snapshot) = 'object'::text) AND COALESCE((jsonb_typeof((worker_spec_snapshot -> 'version'::text)) = 'number'::text), false) AND ((worker_spec_snapshot ->> 'version'::text) ~ '^[1-9][0-9]*$'::text) AND (((worker_spec_snapshot ->> 'version'::text))::numeric <= ('9223372036854775807'::bigint)::numeric)))
);


--
-- Name: expert_market_releases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expert_market_releases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expert_market_releases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expert_market_releases_id_seq OWNED BY public.expert_market_releases.id;


--
-- Name: experts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.experts (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    agent_slug character varying(100) NOT NULL,
    runner_id bigint,
    repository_id bigint,
    branch_name character varying(255),
    prompt text,
    interaction_mode character varying(20) DEFAULT 'pty'::character varying NOT NULL,
    perpetual boolean DEFAULT false NOT NULL,
    used_env_bundles text[] DEFAULT '{}'::text[] NOT NULL,
    skill_slugs text[] DEFAULT '{}'::text[] NOT NULL,
    knowledge_mounts jsonb DEFAULT '[]'::jsonb NOT NULL,
    config_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    agentfile_layer text,
    source_pod_key character varying(100),
    created_by_id bigint NOT NULL,
    run_count integer DEFAULT 0 NOT NULL,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    git_repo_path character varying(255),
    default_branch character varying(255) DEFAULT 'main'::character varying NOT NULL,
    http_clone_url character varying(1000),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    automation_level character varying(20) DEFAULT 'autonomous'::character varying NOT NULL,
    worker_spec_snapshot_id bigint,
    orchestration_resource_id bigint,
    orchestration_resource_revision bigint,
    source_market_application_id bigint,
    source_market_release_id bigint,
    revision bigint DEFAULT 1 NOT NULL,
    CONSTRAINT chk_experts_revision_positive CHECK ((revision > 0)),
    CONSTRAINT experts_automation_level_check CHECK (((automation_level)::text = ANY ((ARRAY['interactive'::character varying, 'auto_edit'::character varying, 'autonomous'::character varying])::text[]))),
    CONSTRAINT experts_market_source_pair_check CHECK (((source_market_application_id IS NULL) = (source_market_release_id IS NULL))),
    CONSTRAINT experts_orchestration_mode_check CHECK ((((orchestration_resource_id IS NULL) AND (orchestration_resource_revision IS NULL)) OR ((orchestration_resource_id IS NOT NULL) AND (orchestration_resource_revision > 0) AND (worker_spec_snapshot_id IS NOT NULL)))),
    CONSTRAINT experts_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100))))
);


--
-- Name: COLUMN experts.git_repo_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.experts.git_repo_path IS 'am-experts/org<ID>-<slug>; NULL = legacy row not yet git-backed (lazy provision on next update).';


--
-- Name: COLUMN experts.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.experts.metadata IS 'Derived cache of expert.json extras: avatar (形象, repo-relative path) + expertType (类型) + future non-column config.';


--
-- Name: experts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.experts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: experts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.experts_id_seq OWNED BY public.experts.id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    uploader_id bigint NOT NULL,
    original_name character varying(255) NOT NULL,
    storage_key character varying(500) NOT NULL,
    mime_type character varying(100) NOT NULL,
    size bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: git_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.git_providers (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    provider_type character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    base_url character varying(255) NOT NULL,
    client_id character varying(255),
    client_secret_encrypted text,
    bot_token_encrypted text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: git_providers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.git_providers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: git_providers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.git_providers_id_seq OWNED BY public.git_providers.id;


--
-- Name: goal_loops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_loops (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    created_by_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    worker_spec_snapshot_id bigint NOT NULL,
    objective text NOT NULL,
    acceptance_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
    verification_command text NOT NULL,
    status character varying(32) DEFAULT 'draft'::character varying NOT NULL,
    pod_key character varying(100),
    autopilot_controller_key character varying(255),
    max_iterations integer DEFAULT 10 NOT NULL,
    token_budget bigint,
    timeout_minutes integer DEFAULT 60 NOT NULL,
    no_progress_limit integer DEFAULT 3 NOT NULL,
    same_error_limit integer DEFAULT 2 NOT NULL,
    escalation_policy character varying(20) DEFAULT 'pause'::character varying NOT NULL,
    verification_request_id character varying(100),
    verification_exit_code integer,
    verification_output text,
    verification_output_truncated boolean DEFAULT false NOT NULL,
    verification_error text,
    started_at timestamp with time zone,
    verified_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    current_iteration integer DEFAULT 0 NOT NULL,
    no_progress_count integer DEFAULT 0 NOT NULL,
    same_error_count integer DEFAULT 0 NOT NULL,
    last_progress_fingerprint character varying(64),
    last_error_fingerprint character varying(64),
    retry_prompt_command_id character varying(64),
    retry_prompt_created_at timestamp with time zone,
    orchestration_resource_id bigint,
    orchestration_resource_revision bigint,
    CONSTRAINT chk_goal_loops_acceptance_criteria CHECK ((jsonb_typeof(acceptance_criteria) = 'array'::text)),
    CONSTRAINT chk_goal_loops_bounds CHECK ((((max_iterations >= 1) AND (max_iterations <= 100)) AND ((timeout_minutes >= 1) AND (timeout_minutes <= 1440)) AND ((no_progress_limit >= 1) AND (no_progress_limit <= 20)) AND ((same_error_limit >= 1) AND (same_error_limit <= 20)))),
    CONSTRAINT chk_goal_loops_escalation_policy CHECK (((escalation_policy)::text = ANY ((ARRAY['pause'::character varying, 'fail'::character varying])::text[]))),
    CONSTRAINT chk_goal_loops_iteration_state CHECK (((current_iteration >= 0) AND (no_progress_count >= 0) AND (same_error_count >= 0))),
    CONSTRAINT chk_goal_loops_retry_prompt_state CHECK ((((retry_prompt_command_id IS NULL) AND (retry_prompt_created_at IS NULL)) OR ((retry_prompt_command_id IS NOT NULL) AND (retry_prompt_created_at IS NOT NULL)))),
    CONSTRAINT chk_goal_loops_slug CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT chk_goal_loops_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'paused'::character varying, 'verifying'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT goal_loops_orchestration_mode_check CHECK ((((orchestration_resource_id IS NULL) AND (orchestration_resource_revision IS NULL)) OR ((orchestration_resource_id IS NOT NULL) AND (orchestration_resource_revision > 0) AND (worker_spec_snapshot_id IS NOT NULL))))
);


--
-- Name: goal_loops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goal_loops_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goal_loops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goal_loops_id_seq OWNED BY public.goal_loops.id;


--
-- Name: identifier_backfill_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identifier_backfill_audit (
    id bigint NOT NULL,
    table_name character varying(50) NOT NULL,
    column_name character varying(50) NOT NULL,
    row_id bigint NOT NULL,
    old_value text NOT NULL,
    new_value text NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: identifier_backfill_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.identifier_backfill_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: identifier_backfill_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.identifier_backfill_audit_id_seq OWNED BY public.identifier_backfill_audit.id;


--
-- Name: im_channel_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.im_channel_connections (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    provider character varying(32) NOT NULL,
    name character varying(255) NOT NULL,
    channel_id bigint,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    webhook_token character varying(64) NOT NULL,
    status character varying(32) DEFAULT 'disabled'::character varying NOT NULL,
    last_error text,
    created_by_user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    config_encrypted text,
    transport character varying(16) DEFAULT 'webhook'::character varying NOT NULL,
    dm_policy character varying(16) DEFAULT 'pairing'::character varying NOT NULL,
    group_policy character varying(16) DEFAULT 'allowlist'::character varying NOT NULL,
    allow_from jsonb DEFAULT '[]'::jsonb NOT NULL,
    streaming_mode character varying(16) DEFAULT 'progress'::character varying NOT NULL,
    last_seen_at timestamp with time zone,
    locale character varying(16) DEFAULT 'zh-CN'::character varying NOT NULL,
    CONSTRAINT im_channel_connections_dm_policy_check CHECK (((dm_policy)::text = ANY ((ARRAY['pairing'::character varying, 'open'::character varying, 'allowlist'::character varying, 'disabled'::character varying, 'guest'::character varying])::text[]))),
    CONSTRAINT im_channel_connections_group_policy_check CHECK (((group_policy)::text = ANY ((ARRAY['open'::character varying, 'allowlist'::character varying, 'disabled'::character varying])::text[]))),
    CONSTRAINT im_channel_connections_locale_check CHECK (((locale)::text = ANY ((ARRAY['en'::character varying, 'zh-CN'::character varying])::text[]))),
    CONSTRAINT im_channel_connections_provider_check CHECK (((provider)::text = ANY ((ARRAY['feishu'::character varying, 'dingtalk'::character varying, 'wecom'::character varying, 'slack'::character varying, 'weixin'::character varying, 'wechat'::character varying])::text[]))),
    CONSTRAINT im_channel_connections_status_check CHECK (((status)::text = ANY ((ARRAY['disabled'::character varying, 'active'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT im_channel_connections_transport_check CHECK (((transport)::text = ANY ((ARRAY['webhook'::character varying, 'stream'::character varying])::text[])))
);


--
-- Name: TABLE im_channel_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.im_channel_connections IS 'Org-scoped IM bridge connections (Feishu/DingTalk/WeCom/Slack) mapped to internal collaboration channels.';


--
-- Name: im_channel_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.im_channel_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: im_channel_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.im_channel_connections_id_seq OWNED BY public.im_channel_connections.id;


--
-- Name: im_identity_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.im_identity_bindings (
    id bigint NOT NULL,
    connection_id bigint NOT NULL,
    external_user_id character varying(255) NOT NULL,
    external_name character varying(255),
    user_id bigint,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    pairing_code character varying(16),
    pairing_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT im_identity_bindings_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'bound'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: im_identity_bindings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.im_identity_bindings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: im_identity_bindings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.im_identity_bindings_id_seq OWNED BY public.im_identity_bindings.id;


--
-- Name: im_inbound_dedupe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.im_inbound_dedupe (
    connection_id bigint NOT NULL,
    external_message_id character varying(255) NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: im_route_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.im_route_bindings (
    id bigint NOT NULL,
    connection_id bigint NOT NULL,
    peer_kind character varying(16) NOT NULL,
    peer_id character varying(512),
    target_kind character varying(16) NOT NULL,
    target_ref character varying(255) NOT NULL,
    require_mention boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT im_route_bindings_peer_kind_check CHECK (((peer_kind)::text = ANY ((ARRAY['direct'::character varying, 'group'::character varying, 'any'::character varying])::text[]))),
    CONSTRAINT im_route_bindings_target_kind_check CHECK (((target_kind)::text = ANY ((ARRAY['pod'::character varying, 'expert'::character varying, 'channel'::character varying])::text[])))
);


--
-- Name: im_route_bindings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.im_route_bindings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: im_route_bindings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.im_route_bindings_id_seq OWNED BY public.im_route_bindings.id;


--
-- Name: im_thread_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.im_thread_mappings (
    id bigint NOT NULL,
    connection_id bigint NOT NULL,
    external_thread_id character varying(512) NOT NULL,
    channel_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    context_token character varying(512),
    peer_kind character varying(16) DEFAULT 'group'::character varying NOT NULL,
    active_target_ref character varying(255),
    draft_message_id character varying(255)
);


--
-- Name: TABLE im_thread_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.im_thread_mappings IS 'Maps external IM thread/chat IDs to internal channel IDs per connection.';


--
-- Name: COLUMN im_thread_mappings.context_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.im_thread_mappings.context_token IS 'Weixin iLink context_token for outbound replies per peer thread.';


--
-- Name: im_thread_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.im_thread_mappings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: im_thread_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.im_thread_mappings_id_seq OWNED BY public.im_thread_mappings.id;


--
-- Name: installed_mcp_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installed_mcp_servers (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    repository_id bigint NOT NULL,
    market_item_id bigint,
    scope character varying(20) NOT NULL,
    installed_by bigint,
    name character varying(100),
    slug character varying(100) NOT NULL,
    transport_type character varying(20) DEFAULT 'stdio'::character varying,
    command character varying(500),
    args jsonb DEFAULT '[]'::jsonb,
    http_url character varying(500),
    http_headers jsonb DEFAULT '{}'::jsonb,
    env_vars jsonb DEFAULT '{}'::jsonb,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT installed_mcp_servers_scope_check CHECK (((scope)::text = ANY ((ARRAY['org'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: installed_mcp_servers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.installed_mcp_servers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: installed_mcp_servers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.installed_mcp_servers_id_seq OWNED BY public.installed_mcp_servers.id;


--
-- Name: installed_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installed_skills (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    repository_id bigint NOT NULL,
    scope character varying(20) NOT NULL,
    installed_by bigint,
    slug character varying(100) NOT NULL,
    install_source character varying(20) NOT NULL,
    source_url character varying(500),
    content_sha character varying(64),
    storage_key character varying(500),
    package_size bigint,
    pinned_version integer,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    skill_id bigint,
    CONSTRAINT installed_skills_scope_check CHECK (((scope)::text = ANY ((ARRAY['org'::character varying, 'user'::character varying])::text[])))
);


--
-- Name: installed_skills_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.installed_skills_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: installed_skills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.installed_skills_id_seq OWNED BY public.installed_skills.id;


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    token character varying(255) NOT NULL,
    invited_by bigint NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invitations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invitations_id_seq OWNED BY public.invitations.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    payment_order_id bigint,
    invoice_no character varying(64) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tax_amount numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    billing_name character varying(255),
    billing_email character varying(255),
    billing_address jsonb,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    pdf_url text,
    issued_at timestamp with time zone,
    due_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invoices IS 'Invoice records for billing history';


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: knowledge_base_agent_mounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_agent_mounts (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    knowledge_base_id bigint NOT NULL,
    agent_slug character varying(100) NOT NULL,
    mode character varying(8) DEFAULT 'ro'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_base_agent_mounts_agent_slug_check CHECK ((((agent_slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((agent_slug)::text) >= 2) AND (char_length((agent_slug)::text) <= 100)))),
    CONSTRAINT knowledge_base_agent_mounts_mode_check CHECK (((mode)::text = ANY ((ARRAY['ro'::character varying, 'rw'::character varying])::text[])))
);


--
-- Name: TABLE knowledge_base_agent_mounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.knowledge_base_agent_mounts IS 'Default KB→agent mounts applied at pod create; mode ro|rw controls whether the pod may push wiki updates back.';


--
-- Name: knowledge_base_agent_mounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_base_agent_mounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_base_agent_mounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_base_agent_mounts_id_seq OWNED BY public.knowledge_base_agent_mounts.id;


--
-- Name: knowledge_bases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_bases (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    git_repo_path character varying(255) NOT NULL,
    http_clone_url character varying(1000) NOT NULL,
    default_branch character varying(255) DEFAULT 'main'::character varying NOT NULL,
    source_type character varying(32) DEFAULT 'git'::character varying NOT NULL,
    source_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    sync_status character varying(32) DEFAULT 'idle'::character varying NOT NULL,
    sync_error text,
    last_synced_at timestamp with time zone,
    created_by_user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_bases_slug_check CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((slug)::text) >= 2) AND (char_length((slug)::text) <= 100)))),
    CONSTRAINT knowledge_bases_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['git'::character varying, 'feishu'::character varying, 'dingtalk'::character varying, 'google'::character varying])::text[]))),
    CONSTRAINT knowledge_bases_sync_status_check CHECK (((sync_status)::text = ANY ((ARRAY['idle'::character varying, 'syncing'::character varying, 'synced'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: TABLE knowledge_bases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.knowledge_bases IS 'Org-scoped llm-wiki knowledge bases; each row maps to an internal Gitea repository with llms.txt / AGENTS.md / raw/ / wiki/ layout.';


--
-- Name: knowledge_bases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_bases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_bases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_bases_id_seq OWNED BY public.knowledge_bases.id;


--
-- Name: labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labels (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    repository_id bigint,
    name character varying(100) NOT NULL,
    color character varying(7) DEFAULT '#6B7280'::character varying NOT NULL
);


--
-- Name: labels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.labels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.labels_id_seq OWNED BY public.labels.id;


--
-- Name: licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licenses (
    id bigint NOT NULL,
    license_key character varying(255) NOT NULL,
    organization_name character varying(255) NOT NULL,
    contact_email character varying(255) NOT NULL,
    plan_name character varying(50) NOT NULL,
    max_users integer DEFAULT '-1'::integer NOT NULL,
    max_runners integer DEFAULT '-1'::integer NOT NULL,
    max_repositories integer DEFAULT '-1'::integer NOT NULL,
    max_concurrent_pods integer DEFAULT '-1'::integer NOT NULL,
    features jsonb DEFAULT '{}'::jsonb,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    signature text NOT NULL,
    public_key_fingerprint character varying(64),
    is_active boolean DEFAULT true NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason text,
    activated_at timestamp with time zone,
    activated_org_id bigint,
    last_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE licenses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.licenses IS 'License keys for OnPremise deployments';


--
-- Name: licenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.licenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: licenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.licenses_id_seq OWNED BY public.licenses.id;


--
-- Name: mcp_market_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_market_items (
    id bigint NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    transport_type character varying(20) DEFAULT 'stdio'::character varying,
    command character varying(500),
    default_args jsonb DEFAULT '[]'::jsonb,
    default_http_url character varying(500),
    default_http_headers jsonb DEFAULT '[]'::jsonb,
    env_var_schema jsonb DEFAULT '[]'::jsonb,
    agent_filter jsonb,
    category character varying(50),
    source character varying(20) DEFAULT 'seed'::character varying,
    registry_name character varying(200),
    version character varying(50),
    repository_url character varying(500),
    registry_meta jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: mcp_market_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mcp_market_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mcp_market_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mcp_market_items_id_seq OWNED BY public.mcp_market_items.id;


--
-- Name: model_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_prices (
    model character varying(100) NOT NULL,
    input_per_million numeric(12,6) DEFAULT 0 NOT NULL,
    output_per_million numeric(12,6) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: model_resource_defaults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_resource_defaults (
    owner_scope character varying(16) NOT NULL,
    owner_id bigint NOT NULL,
    modality character varying(16) NOT NULL,
    model_resource_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT model_resource_defaults_modality_check CHECK (((modality)::text = ANY ((ARRAY['chat'::character varying, 'image'::character varying, 'audio'::character varying, 'video'::character varying, 'embedding'::character varying, 'multimodal'::character varying])::text[]))),
    CONSTRAINT model_resource_defaults_owner_id_check CHECK ((owner_id > 0)),
    CONSTRAINT model_resource_defaults_owner_scope_check CHECK (((owner_scope)::text = ANY ((ARRAY['user'::character varying, 'org'::character varying])::text[])))
);


--
-- Name: model_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_resources (
    id bigint NOT NULL,
    provider_connection_id bigint NOT NULL,
    identifier character varying(100) NOT NULL,
    model_id character varying(500) NOT NULL,
    display_name character varying(200) NOT NULL,
    modalities jsonb NOT NULL,
    capabilities jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(16) DEFAULT 'unchecked'::character varying NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    last_validated_at timestamp with time zone,
    validation_error text DEFAULT ''::text NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT model_resources_capabilities_check CHECK ((jsonb_typeof(capabilities) = 'array'::text)),
    CONSTRAINT model_resources_identifier_check CHECK ((((identifier)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((identifier)::text) >= 2) AND (char_length((identifier)::text) <= 100)))),
    CONSTRAINT model_resources_modalities_check CHECK (((jsonb_typeof(modalities) = 'array'::text) AND (jsonb_array_length(modalities) > 0))),
    CONSTRAINT model_resources_model_id_check CHECK ((char_length(btrim((model_id)::text)) > 0)),
    CONSTRAINT model_resources_revision_check CHECK ((revision > 0)),
    CONSTRAINT model_resources_status_check CHECK (((status)::text = ANY ((ARRAY['unchecked'::character varying, 'valid'::character varying, 'invalid'::character varying])::text[])))
);


--
-- Name: model_resources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.model_resources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: model_resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.model_resources_id_seq OWNED BY public.model_resources.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    source character varying(50) NOT NULL,
    entity_id character varying(200) DEFAULT ''::character varying NOT NULL,
    is_muted boolean DEFAULT false,
    channels jsonb DEFAULT '{"toast": true, "browser": true}'::jsonb
);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_preferences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: orchestration_resource_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orchestration_resource_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id bigint NOT NULL,
    actor_id bigint NOT NULL,
    target_resource_id bigint,
    target_api_version character varying(64) NOT NULL,
    target_kind character varying(100) NOT NULL,
    target_namespace character varying(100) NOT NULL,
    target_name character varying(100) NOT NULL,
    operation character varying(16) NOT NULL,
    base_head_uid uuid,
    base_resource_version bigint,
    draft_hash character varying(71) NOT NULL,
    plan_hash character varying(71) NOT NULL,
    canonical_manifest jsonb NOT NULL,
    resolved_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    semantic_diff jsonb DEFAULT '[]'::jsonb NOT NULL,
    issues jsonb DEFAULT '[]'::jsonb NOT NULL,
    artifact_kind character varying(100) NOT NULL,
    artifact_json jsonb NOT NULL,
    artifact_digest character varying(71) NOT NULL,
    options_revision character varying(128) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    consumed_by_id bigint,
    consumption_result character varying(16),
    result_resource_id bigint,
    result_resource_uid uuid,
    result_resource_version bigint,
    result_revision bigint,
    result_json jsonb,
    CONSTRAINT orchestration_resource_plans_artifact_kind_check CHECK (((artifact_kind)::text ~ '^[A-Z][A-Za-z0-9]{1,99}$'::text)),
    CONSTRAINT orchestration_resource_plans_base_state_check CHECK ((((((operation)::text = 'create'::text) AND (target_resource_id IS NULL) AND (base_head_uid IS NULL) AND (base_resource_version IS NULL)) OR (((operation)::text = 'update'::text) AND (target_resource_id IS NOT NULL) AND (base_head_uid IS NOT NULL) AND (base_resource_version IS NOT NULL) AND (base_resource_version > 0))) IS TRUE)),
    CONSTRAINT orchestration_resource_plans_consumption_check CHECK (((((consumed_at IS NULL) AND (consumed_by_id IS NULL) AND (consumption_result IS NULL) AND (result_resource_id IS NULL) AND (result_resource_uid IS NULL) AND (result_resource_version IS NULL) AND (result_revision IS NULL) AND (result_json IS NULL)) OR ((consumed_at IS NOT NULL) AND (consumed_by_id = actor_id) AND ((consumption_result)::text = 'applied'::text) AND (result_resource_id IS NOT NULL) AND (result_resource_uid IS NOT NULL) AND (consumed_at >= created_at) AND (consumed_at < expires_at) AND (result_resource_version IS NOT NULL) AND (result_resource_version > 0) AND (result_revision IS NOT NULL) AND (result_revision > 0) AND (jsonb_typeof(result_json) = 'object'::text)) OR ((consumed_at IS NOT NULL) AND (consumed_by_id = actor_id) AND ((consumption_result)::text = ANY ((ARRAY['cancelled'::character varying, 'expired'::character varying])::text[])) AND (consumed_at >= created_at) AND ((((consumption_result)::text = 'cancelled'::text) AND (consumed_at < expires_at)) OR (((consumption_result)::text = 'expired'::text) AND (consumed_at >= expires_at))) AND (result_resource_id IS NULL) AND (result_resource_uid IS NULL) AND (result_resource_version IS NULL) AND (result_revision IS NULL) AND (jsonb_typeof(result_json) = 'object'::text))) IS TRUE)),
    CONSTRAINT orchestration_resource_plans_expiry_check CHECK ((isfinite(created_at) AND isfinite(expires_at) AND (expires_at > created_at) AND ((consumed_at IS NULL) OR isfinite(consumed_at)))),
    CONSTRAINT orchestration_resource_plans_hashes_check CHECK ((((draft_hash)::text ~ '^sha256:[0-9a-f]{64}$'::text) AND ((plan_hash)::text ~ '^sha256:[0-9a-f]{64}$'::text) AND ((artifact_digest)::text ~ '^sha256:[0-9a-f]{64}$'::text))),
    CONSTRAINT orchestration_resource_plans_identifiers_check CHECK ((public.orchestration_identifier_valid((target_namespace)::text) AND public.orchestration_identifier_valid((target_name)::text))),
    CONSTRAINT orchestration_resource_plans_json_shapes_check CHECK (((jsonb_typeof(canonical_manifest) = 'object'::text) AND (jsonb_typeof(resolved_refs) = 'array'::text) AND (jsonb_typeof(semantic_diff) = 'array'::text) AND (jsonb_typeof(issues) = 'array'::text) AND (jsonb_typeof(artifact_json) = 'object'::text))),
    CONSTRAINT orchestration_resource_plans_operation_check CHECK (((operation)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying])::text[]))),
    CONSTRAINT orchestration_resource_plans_options_revision_check CHECK ((((char_length((options_revision)::text) >= 1) AND (char_length((options_revision)::text) <= 128)) AND ((options_revision)::text = btrim((options_revision)::text)) AND ((options_revision)::text !~ '[[:cntrl:]]'::text))),
    CONSTRAINT orchestration_resource_plans_result_enum_check CHECK (((consumption_result IS NULL) OR ((consumption_result)::text = ANY ((ARRAY['applied'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))),
    CONSTRAINT orchestration_resource_plans_type_meta_check CHECK ((((target_api_version)::text = 'agentcloud.io/v1alpha1'::text) AND ((target_kind)::text ~ '^[A-Z][A-Za-z0-9]{1,99}$'::text)))
);


--
-- Name: orchestration_resource_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orchestration_resource_revisions (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    resource_id bigint NOT NULL,
    revision bigint NOT NULL,
    generation bigint NOT NULL,
    resource_version bigint NOT NULL,
    canonical_manifest jsonb NOT NULL,
    canonical_spec jsonb NOT NULL,
    resolved_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    digest character varying(71) NOT NULL,
    worker_spec_snapshot_id bigint,
    actor_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orchestration_resource_revisions_created_at_check CHECK (isfinite(created_at)),
    CONSTRAINT orchestration_resource_revisions_digest_check CHECK (((digest)::text ~ '^sha256:[0-9a-f]{64}$'::text)),
    CONSTRAINT orchestration_resource_revisions_manifest_object CHECK ((jsonb_typeof(canonical_manifest) = 'object'::text)),
    CONSTRAINT orchestration_resource_revisions_positive_counters CHECK (((revision > 0) AND (generation > 0) AND (generation <= revision) AND (resource_version >= revision))),
    CONSTRAINT orchestration_resource_revisions_refs_array CHECK ((jsonb_typeof(resolved_refs) = 'array'::text)),
    CONSTRAINT orchestration_resource_revisions_spec_object CHECK ((jsonb_typeof(canonical_spec) = 'object'::text))
);


--
-- Name: orchestration_resource_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orchestration_resource_revisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orchestration_resource_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orchestration_resource_revisions_id_seq OWNED BY public.orchestration_resource_revisions.id;


--
-- Name: orchestration_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orchestration_resources (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    uid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    api_version character varying(64) NOT NULL,
    kind character varying(100) NOT NULL,
    namespace character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(200) DEFAULT ''::character varying NOT NULL,
    labels jsonb DEFAULT '{}'::jsonb NOT NULL,
    status jsonb DEFAULT '{}'::jsonb NOT NULL,
    generation bigint DEFAULT 1 NOT NULL,
    resource_version bigint DEFAULT 1 NOT NULL,
    active_revision bigint DEFAULT 1 NOT NULL,
    created_by_id bigint NOT NULL,
    updated_by_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orchestration_resources_api_version_check CHECK (((api_version)::text = 'agentcloud.io/v1alpha1'::text)),
    CONSTRAINT orchestration_resources_kind_check CHECK (((kind)::text ~ '^[A-Z][A-Za-z0-9]{1,99}$'::text)),
    CONSTRAINT orchestration_resources_labels_object CHECK ((jsonb_typeof(labels) = 'object'::text)),
    CONSTRAINT orchestration_resources_name_check CHECK (public.orchestration_identifier_valid((name)::text)),
    CONSTRAINT orchestration_resources_namespace_check CHECK (public.orchestration_identifier_valid((namespace)::text)),
    CONSTRAINT orchestration_resources_positive_counters CHECK (((generation > 0) AND (generation <= active_revision) AND (resource_version >= active_revision))),
    CONSTRAINT orchestration_resources_status_object CHECK ((jsonb_typeof(status) = 'object'::text)),
    CONSTRAINT orchestration_resources_timestamps_check CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))
);


--
-- Name: orchestration_resources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orchestration_resources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orchestration_resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orchestration_resources_id_seq OWNED BY public.orchestration_resources.id;


--
-- Name: orchestration_worker_launches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orchestration_worker_launches (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    actor_id bigint NOT NULL,
    plan_id uuid NOT NULL,
    resource_id bigint NOT NULL,
    resource_revision bigint NOT NULL,
    worker_spec_snapshot_id bigint NOT NULL,
    prompt text,
    alias character varying(100) DEFAULT ''::character varying NOT NULL,
    state character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    claim_token uuid,
    lease_expires_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error text,
    pod_id bigint,
    pod_key character varying(100),
    runner_id bigint,
    dispatched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orchestration_worker_launches_attempt_check CHECK ((attempt_count >= 0)),
    CONSTRAINT orchestration_worker_launches_state_check CHECK (((state)::text = ANY ((ARRAY['pending'::character varying, 'materializing'::character varying, 'dispatched'::character varying])::text[]))),
    CONSTRAINT orchestration_worker_launches_state_fields_check CHECK ((((((state)::text = 'pending'::text) AND (claim_token IS NULL) AND (lease_expires_at IS NULL) AND (pod_id IS NULL) AND (pod_key IS NULL) AND (runner_id IS NULL) AND (dispatched_at IS NULL)) OR (((state)::text = 'materializing'::text) AND (claim_token IS NOT NULL) AND (lease_expires_at IS NOT NULL) AND (pod_id IS NULL) AND (pod_key IS NULL) AND (runner_id IS NULL) AND (dispatched_at IS NULL)) OR (((state)::text = 'dispatched'::text) AND (claim_token IS NULL) AND (lease_expires_at IS NULL) AND (pod_id IS NOT NULL) AND (pod_key IS NOT NULL) AND (runner_id IS NOT NULL) AND (dispatched_at IS NOT NULL))) IS TRUE)),
    CONSTRAINT orchestration_worker_launches_timestamps_check CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at) AND ((lease_expires_at IS NULL) OR isfinite(lease_expires_at)) AND ((dispatched_at IS NULL) OR isfinite(dispatched_at))))
);


--
-- Name: orchestration_worker_launches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orchestration_worker_launches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orchestration_worker_launches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orchestration_worker_launches_id_seq OWNED BY public.orchestration_worker_launches.id;


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_members_id_seq OWNED BY public.organization_members.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    logo_url text,
    subscription_plan character varying(50) DEFAULT 'free'::character varying NOT NULL,
    subscription_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    amp_tenant_id character varying(100)
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: payment_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_orders (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    order_no character varying(64) NOT NULL,
    external_order_no character varying(255),
    order_type character varying(50) NOT NULL,
    plan_id bigint,
    billing_cycle character varying(20),
    seats integer DEFAULT 1,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0,
    actual_amount numeric(10,2) NOT NULL,
    payment_provider character varying(50) NOT NULL,
    payment_method character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    failure_reason text,
    idempotency_key character varying(64),
    expires_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL
);


--
-- Name: TABLE payment_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_orders IS 'Payment orders for subscriptions, seat purchases, and upgrades';


--
-- Name: payment_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_orders_id_seq OWNED BY public.payment_orders.id;


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id bigint NOT NULL,
    payment_order_id bigint NOT NULL,
    transaction_type character varying(50) NOT NULL,
    external_transaction_id character varying(255),
    amount numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    status character varying(50) NOT NULL,
    webhook_event_id character varying(255),
    webhook_event_type character varying(100),
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE payment_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_transactions IS 'Payment transaction history and webhook events';


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_transactions_id_seq OWNED BY public.payment_transactions.id;


--
-- Name: pending_runner_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_runner_commands (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    runner_id bigint NOT NULL,
    pod_key character varying(100) NOT NULL,
    command_type character varying(20) NOT NULL,
    command_id character varying(64) NOT NULL,
    payload bytea NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pending_runner_commands_command_type_check CHECK (((command_type)::text = ANY ((ARRAY['create_pod'::character varying, 'send_prompt'::character varying])::text[])))
);


--
-- Name: pending_runner_commands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_runner_commands_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_runner_commands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_runner_commands_id_seq OWNED BY public.pending_runner_commands.id;


--
-- Name: permission_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_policies (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    scope character varying(20) DEFAULT 'org'::character varying NOT NULL,
    agent_slug character varying(50),
    tool_pattern text NOT NULL,
    path_pattern text,
    verdict character varying(10) NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    policy_handler character varying(50) DEFAULT 'acp_tool_rule'::character varying NOT NULL,
    max_usd numeric(12,6),
    session_id character varying(100),
    CONSTRAINT permission_policies_policy_handler_check CHECK (((policy_handler)::text = ANY ((ARRAY['acp_tool_rule'::character varying, 'session_cost_budget'::character varying])::text[]))),
    CONSTRAINT permission_policies_scope_check CHECK (((scope)::text = ANY ((ARRAY['org'::character varying, 'project'::character varying, 'pod'::character varying, 'session'::character varying])::text[]))),
    CONSTRAINT permission_policies_verdict_check CHECK (((verdict)::text = ANY ((ARRAY['allow'::character varying, 'deny'::character varying, 'ask'::character varying])::text[])))
);


--
-- Name: permission_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_policies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_policies_id_seq OWNED BY public.permission_policies.id;


--
-- Name: plan_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_prices (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    currency character varying(3) NOT NULL,
    price_monthly numeric(10,2) NOT NULL,
    price_yearly numeric(10,2) NOT NULL,
    stripe_price_id_monthly character varying(255),
    stripe_price_id_yearly character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lemonsqueezy_variant_id_monthly character varying(255),
    lemonsqueezy_variant_id_yearly character varying(255)
);


--
-- Name: TABLE plan_prices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.plan_prices IS 'Multi-currency pricing for subscription plans';


--
-- Name: COLUMN plan_prices.lemonsqueezy_variant_id_monthly; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_prices.lemonsqueezy_variant_id_monthly IS 'LemonSqueezy Variant ID for monthly billing';


--
-- Name: COLUMN plan_prices.lemonsqueezy_variant_id_yearly; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_prices.lemonsqueezy_variant_id_yearly IS 'LemonSqueezy Variant ID for yearly billing';


--
-- Name: plan_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plan_prices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plan_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plan_prices_id_seq OWNED BY public.plan_prices.id;


--
-- Name: pod_bindings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pod_bindings (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    initiator_pod character varying(100) NOT NULL,
    target_pod character varying(100) NOT NULL,
    granted_scopes text[],
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pending_scopes text[],
    requested_at timestamp with time zone,
    responded_at timestamp with time zone,
    expires_at timestamp with time zone,
    rejection_reason character varying(500)
);


--
-- Name: pod_bindings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pod_bindings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pod_bindings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pod_bindings_id_seq OWNED BY public.pod_bindings.id;


--
-- Name: pod_config_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pod_config_revisions (
    id bigint NOT NULL,
    pod_id bigint NOT NULL,
    revision bigint NOT NULL,
    agentfile_layer text DEFAULT ''::text NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    config_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    model_resource_id bigint,
    created_by_id bigint NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    preview_port integer DEFAULT 0 NOT NULL,
    preview_path character varying(255) DEFAULT '/'::character varying NOT NULL,
    CONSTRAINT pod_config_revisions_config_summary_object CHECK ((jsonb_typeof(config_summary) = 'object'::text)),
    CONSTRAINT pod_config_revisions_preview_path_check CHECK ((((preview_path)::text <> ''::text) AND ("left"((preview_path)::text, 1) = '/'::text) AND (POSITION(('?'::text) IN (preview_path)) = 0) AND (POSITION(('#'::text) IN (preview_path)) = 0) AND (POSITION(('//'::text) IN (preview_path)) = 0) AND (((preview_path)::text = '/'::text) OR ("right"((preview_path)::text, 1) <> '/'::text)) AND ((preview_path)::text !~ '(^|/)\.{1,2}(/|$)'::text) AND ((preview_path)::text !~* '%2e|%2f'::text) AND (POSITION(('%'::text) IN (regexp_replace((preview_path)::text, '%[0-9A-Fa-f]{2}'::text, ''::text, 'g'::text))) = 0))),
    CONSTRAINT pod_config_revisions_preview_port_check CHECK (((preview_port = 0) OR ((preview_port >= 1024) AND (preview_port <= 65535)))),
    CONSTRAINT pod_config_revisions_revision_positive CHECK ((revision > 0)),
    CONSTRAINT pod_config_revisions_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'applying'::character varying, 'active'::character varying, 'failed'::character varying, 'superseded'::character varying])::text[])))
);


--
-- Name: pod_config_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pod_config_revisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pod_config_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pod_config_revisions_id_seq OWNED BY public.pod_config_revisions.id;


--
-- Name: pod_session_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pod_session_usage (
    pod_key character varying(100) NOT NULL,
    model character varying(100) NOT NULL,
    input_tokens bigint DEFAULT 0 NOT NULL,
    output_tokens bigint DEFAULT 0 NOT NULL,
    cache_read_tokens bigint DEFAULT 0 NOT NULL,
    cache_creation_tokens bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pods (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    pod_key character varying(100) NOT NULL,
    runner_id bigint NOT NULL,
    repository_id bigint,
    ticket_id bigint,
    created_by_id bigint NOT NULL,
    pty_pid integer,
    status character varying(50) DEFAULT 'initializing'::character varying NOT NULL,
    agent_status character varying(50) DEFAULT 'idle'::character varying NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    last_activity timestamp with time zone,
    prompt text,
    branch_name character varying(255),
    sandbox_path character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model character varying(50),
    permission_mode character varying(50),
    think_level character varying(50),
    agent_pid integer,
    config_overrides jsonb DEFAULT '{}'::jsonb,
    title character varying(255),
    session_id character varying(36),
    source_pod_key character varying(100),
    error_code character varying(100),
    error_message text,
    agent_waiting_since timestamp with time zone,
    alias character varying(100),
    interaction_mode character varying(10) DEFAULT 'pty'::character varying NOT NULL,
    agent_slug character varying(100),
    perpetual boolean DEFAULT false NOT NULL,
    restart_count integer DEFAULT 0 NOT NULL,
    last_restart_at timestamp with time zone,
    external_session_id character varying(200),
    virtual_api_key_id bigint,
    preview_port integer DEFAULT 0 NOT NULL,
    preview_path character varying(255) DEFAULT ''::character varying NOT NULL,
    automation_level character varying(20) DEFAULT 'autonomous'::character varying NOT NULL,
    model_resource_id bigint,
    generation bigint DEFAULT 0 NOT NULL,
    active_config_revision_id bigint,
    pending_config_revision_id bigint,
    reinitialize_dispatched_at timestamp with time zone,
    archived_at timestamp with time zone,
    archived_by_id bigint,
    purge_after timestamp with time zone,
    worker_spec_snapshot_id bigint,
    cluster_id bigint NOT NULL,
    orchestration_worker_launch_id bigint,
    CONSTRAINT pods_automation_level_check CHECK (((automation_level)::text = ANY ((ARRAY['interactive'::character varying, 'auto_edit'::character varying, 'autonomous'::character varying])::text[]))),
    CONSTRAINT pods_generation_nonnegative CHECK ((generation >= 0)),
    CONSTRAINT pods_preview_path_check CHECK ((((preview_path)::text <> ''::text) AND ("left"((preview_path)::text, 1) = '/'::text) AND (POSITION(('?'::text) IN (preview_path)) = 0) AND (POSITION(('#'::text) IN (preview_path)) = 0) AND (POSITION(('//'::text) IN (preview_path)) = 0) AND (((preview_path)::text = '/'::text) OR ("right"((preview_path)::text, 1) <> '/'::text)) AND ((preview_path)::text !~ '(^|/)\.{1,2}(/|$)'::text) AND ((preview_path)::text !~* '%2e|%2f'::text) AND (POSITION(('%'::text) IN (regexp_replace((preview_path)::text, '%[0-9A-Fa-f]{2}'::text, ''::text, 'g'::text))) = 0))),
    CONSTRAINT pods_preview_port_check CHECK (((preview_port = 0) OR ((preview_port >= 1024) AND (preview_port <= 65535))))
);


--
-- Name: COLUMN pods.config_overrides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pods.config_overrides IS 'Pod-level configuration overrides, merged with organization defaults during Pod creation.';


--
-- Name: pods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pods_id_seq OWNED BY public.pods.id;


--
-- Name: promo_code_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_redemptions (
    id bigint NOT NULL,
    promo_code_id bigint NOT NULL,
    organization_id bigint NOT NULL,
    user_id bigint NOT NULL,
    plan_name character varying(50) NOT NULL,
    duration_months integer NOT NULL,
    previous_plan_name character varying(50),
    previous_period_end timestamp with time zone,
    new_period_end timestamp with time zone NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promo_code_redemptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_code_redemptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_code_redemptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_code_redemptions_id_seq OWNED BY public.promo_code_redemptions.id;


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id bigint NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type character varying(50) NOT NULL,
    plan_name character varying(50) NOT NULL,
    duration_months integer NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    max_uses_per_org integer DEFAULT 1 NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_codes_id_seq OWNED BY public.promo_codes.id;


--
-- Name: provider_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_connections (
    id bigint NOT NULL,
    owner_scope character varying(16) NOT NULL,
    owner_id bigint NOT NULL,
    identifier character varying(100) NOT NULL,
    provider_key character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    base_url character varying(1000) DEFAULT ''::character varying NOT NULL,
    credentials_encrypted text DEFAULT ''::text NOT NULL,
    configured_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(16) DEFAULT 'unchecked'::character varying NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    last_validated_at timestamp with time zone,
    validation_error text DEFAULT ''::text NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT provider_connections_configured_fields_check CHECK ((jsonb_typeof(configured_fields) = 'array'::text)),
    CONSTRAINT provider_connections_identifier_check CHECK ((((identifier)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((identifier)::text) >= 2) AND (char_length((identifier)::text) <= 100)))),
    CONSTRAINT provider_connections_owner_id_check CHECK ((owner_id > 0)),
    CONSTRAINT provider_connections_owner_scope_check CHECK (((owner_scope)::text = ANY ((ARRAY['user'::character varying, 'org'::character varying])::text[]))),
    CONSTRAINT provider_connections_provider_key_check CHECK ((((provider_key)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((provider_key)::text) >= 2) AND (char_length((provider_key)::text) <= 100)))),
    CONSTRAINT provider_connections_revision_check CHECK ((revision > 0)),
    CONSTRAINT provider_connections_status_check CHECK (((status)::text = ANY ((ARRAY['unchecked'::character varying, 'valid'::character varying, 'invalid'::character varying])::text[])))
);


--
-- Name: provider_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.provider_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provider_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.provider_connections_id_seq OWNED BY public.provider_connections.id;


--
-- Name: ralph_iterations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ralph_iterations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ralph_iterations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ralph_iterations_id_seq OWNED BY public.autopilot_iterations.id;


--
-- Name: ralph_pods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ralph_pods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ralph_pods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ralph_pods_id_seq OWNED BY public.autopilot_controllers.id;


--
-- Name: repositories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repositories (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    external_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(500) NOT NULL,
    default_branch character varying(100) DEFAULT 'main'::character varying,
    ticket_prefix character varying(10),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider_type character varying(50) NOT NULL,
    provider_base_url character varying(255) NOT NULL,
    visibility character varying(20) DEFAULT 'organization'::character varying NOT NULL,
    imported_by_user_id bigint,
    deleted_at timestamp with time zone,
    preparation_script text,
    preparation_timeout integer DEFAULT 300,
    webhook_config jsonb,
    http_clone_url character varying(500),
    ssh_clone_url character varying(500)
);


--
-- Name: COLUMN repositories.preparation_script; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repositories.preparation_script IS 'Script to run after worktree creation for workspace initialization';


--
-- Name: COLUMN repositories.preparation_timeout; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repositories.preparation_timeout IS 'Timeout in seconds for preparation script execution (default 300)';


--
-- Name: COLUMN repositories.webhook_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.repositories.webhook_config IS 'Webhook configuration stored as JSONB (id, url, secret, events, is_active, needs_manual_setup, last_error, created_at)';


--
-- Name: repositories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repositories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repositories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.repositories_id_seq OWNED BY public.repositories.id;


--
-- Name: resource_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_grants (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    resource_type character varying(32) NOT NULL,
    resource_id character varying(64) NOT NULL,
    user_id bigint NOT NULL,
    granted_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resource_grants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resource_grants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resource_grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resource_grants_id_seq OWNED BY public.resource_grants.id;


--
-- Name: runner_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runner_certificates (
    id bigint NOT NULL,
    runner_id bigint,
    serial_number character varying(64) NOT NULL,
    fingerprint character varying(128) NOT NULL,
    issued_at timestamp without time zone NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked_at timestamp without time zone,
    revocation_reason character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: runner_certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.runner_certificates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: runner_certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.runner_certificates_id_seq OWNED BY public.runner_certificates.id;


--
-- Name: runner_grpc_registration_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runner_grpc_registration_tokens (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    token_hash character varying(255) NOT NULL,
    description text,
    created_by_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name character varying(255),
    labels jsonb,
    single_use boolean DEFAULT true,
    created_by bigint,
    cluster_id bigint NOT NULL
);


--
-- Name: runner_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runner_logs (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    runner_id bigint NOT NULL,
    request_id character varying(36) NOT NULL,
    storage_key character varying(500),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    size_bytes bigint DEFAULT 0,
    error_message text,
    requested_by_id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    CONSTRAINT runner_logs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'collecting'::character varying, 'uploading'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: runner_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.runner_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: runner_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.runner_logs_id_seq OWNED BY public.runner_logs.id;


--
-- Name: runner_pending_auths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runner_pending_auths (
    id bigint NOT NULL,
    auth_key character varying(64) NOT NULL,
    machine_key character varying(128) NOT NULL,
    node_id character varying(255),
    labels jsonb,
    authorized boolean DEFAULT false NOT NULL,
    organization_id bigint,
    runner_id bigint,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cluster_id bigint,
    CONSTRAINT runner_pending_auths_cluster_ownership_check CHECK ((((organization_id IS NULL) AND (cluster_id IS NULL) AND (authorized = false)) OR ((organization_id IS NOT NULL) AND (cluster_id IS NOT NULL))))
);


--
-- Name: runner_pending_auths_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.runner_pending_auths_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: runner_pending_auths_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.runner_pending_auths_id_seq OWNED BY public.runner_pending_auths.id;


--
-- Name: runner_reactivation_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runner_reactivation_tokens (
    id bigint NOT NULL,
    token_hash character varying(128) NOT NULL,
    runner_id bigint NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_by bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: runner_reactivation_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.runner_reactivation_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: runner_reactivation_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.runner_reactivation_tokens_id_seq OWNED BY public.runner_reactivation_tokens.id;


--
-- Name: runner_registration_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.runner_registration_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: runner_registration_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.runner_registration_tokens_id_seq OWNED BY public.runner_grpc_registration_tokens.id;


--
-- Name: runners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runners (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    node_id character varying(100) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'offline'::character varying NOT NULL,
    last_heartbeat timestamp with time zone,
    current_pods integer DEFAULT 0 NOT NULL,
    max_concurrent_pods integer DEFAULT 5 NOT NULL,
    runner_version character varying(50),
    host_info jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    available_agents jsonb DEFAULT '[]'::jsonb,
    cert_serial_number character varying(64),
    cert_expires_at timestamp without time zone,
    visibility character varying(20) DEFAULT 'organization'::character varying NOT NULL,
    registered_by_user_id bigint,
    agent_versions jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    cluster_id bigint NOT NULL,
    tunnel_state character varying(32) DEFAULT 'disconnected'::character varying NOT NULL,
    tunnel_last_seen_at timestamp with time zone,
    tunnel_last_error character varying(255)
);


--
-- Name: COLUMN runners.is_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runners.is_enabled IS 'Whether the runner is enabled and can accept new pods';


--
-- Name: COLUMN runners.available_agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runners.available_agents IS 'List of agent type slugs available on this runner, populated during initialization handshake';


--
-- Name: COLUMN runners.agent_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runners.agent_versions IS 'Detected version info for installed agents [{slug, version, path}], populated during initialization handshake';


--
-- Name: runners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.runners_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: runners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.runners_id_seq OWNED BY public.runners.id;


--
-- Name: session_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_comments (
    id character varying(100) NOT NULL,
    session_id character varying(100) NOT NULL,
    path character varying(500) NOT NULL,
    start_index integer NOT NULL,
    end_index integer NOT NULL,
    body text NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    anchor_content text,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_comments_check CHECK ((end_index > start_index)),
    CONSTRAINT session_comments_id_check CHECK ((((id)::text ~ '^cmt_[a-z0-9]+$'::text) AND ((char_length((id)::text) >= 8) AND (char_length((id)::text) <= 100)))),
    CONSTRAINT session_comments_start_index_check CHECK ((start_index >= 0)),
    CONSTRAINT session_comments_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'addressed'::character varying])::text[])))
);


--
-- Name: session_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_files (
    id character varying(100) NOT NULL,
    session_id character varying(100) NOT NULL,
    filename character varying(255) NOT NULL,
    bytes bigint NOT NULL,
    content_type character varying(100) NOT NULL,
    minio_key character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_files_bytes_check CHECK ((bytes >= 0)),
    CONSTRAINT session_files_id_check CHECK ((((id)::text ~ '^file_[a-z0-9]+$'::text) AND ((char_length((id)::text) >= 8) AND (char_length((id)::text) <= 100))))
);


--
-- Name: session_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_permissions (
    session_id character varying(100) NOT NULL,
    user_id character varying(255) NOT NULL,
    level integer NOT NULL,
    CONSTRAINT session_permissions_level_check CHECK (((level >= 1) AND (level <= 4)))
);


--
-- Name: session_read_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_read_states (
    user_id bigint NOT NULL,
    session_id character varying(100) NOT NULL,
    last_seen bigint DEFAULT 0 NOT NULL,
    unread boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_read_states_session_id_check CHECK ((((session_id)::text ~ '^conv_[a-z0-9]+$'::text) AND ((char_length((session_id)::text) >= 8) AND (char_length((session_id)::text) <= 100))))
);


--
-- Name: sso_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sso_configs (
    id bigint NOT NULL,
    domain character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    protocol public.sso_protocol NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    enforce_sso boolean DEFAULT false NOT NULL,
    oidc_issuer_url text,
    oidc_client_id character varying(255),
    oidc_client_secret_encrypted text,
    oidc_scopes text,
    saml_idp_metadata_url text,
    saml_idp_metadata_xml text,
    saml_idp_sso_url text,
    saml_idp_cert_encrypted text,
    saml_sp_entity_id text,
    saml_name_id_format character varying(100) DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'::character varying,
    ldap_host character varying(255),
    ldap_port integer DEFAULT 389,
    ldap_use_tls boolean DEFAULT false,
    ldap_bind_dn text,
    ldap_bind_password_encrypted text,
    ldap_base_dn text,
    ldap_user_filter text DEFAULT '(uid={{username}})'::text,
    ldap_email_attr character varying(100) DEFAULT 'mail'::character varying,
    ldap_name_attr character varying(100) DEFAULT 'cn'::character varying,
    ldap_username_attr character varying(100) DEFAULT 'uid'::character varying,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_organization_id bigint,
    oidc_authorize_extra_params text,
    amp_bearer_app_codes jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: sso_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sso_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sso_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sso_configs_id_seq OWNED BY public.sso_configs.id;


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id bigint NOT NULL,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    price_per_seat_monthly numeric(10,2) DEFAULT 0 NOT NULL,
    included_pod_minutes integer DEFAULT 0 NOT NULL,
    price_per_extra_minute numeric(10,4) DEFAULT 0 NOT NULL,
    max_users integer NOT NULL,
    max_runners integer NOT NULL,
    max_repositories integer NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    max_concurrent_pods integer DEFAULT 0 NOT NULL,
    price_per_seat_yearly numeric(10,2) DEFAULT 0,
    stripe_price_id_monthly character varying(255),
    stripe_price_id_yearly character varying(255)
);


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_plans_id_seq OWNED BY public.subscription_plans.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    plan_id bigint NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    custom_quotas jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_provider character varying(50),
    payment_method character varying(50),
    auto_renew boolean DEFAULT false NOT NULL,
    seat_count integer DEFAULT 1 NOT NULL,
    canceled_at timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    frozen_at timestamp with time zone,
    downgrade_to_plan character varying(50),
    next_billing_cycle character varying(20),
    alipay_agreement_no character varying(255),
    wechat_contract_id character varying(255),
    lemonsqueezy_customer_id character varying(255),
    lemonsqueezy_subscription_id character varying(255)
);


--
-- Name: COLUMN subscriptions.payment_provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.payment_provider IS 'Payment provider: stripe, alipay, wechat, license';


--
-- Name: COLUMN subscriptions.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.payment_method IS 'Payment method: card, alipay_qr, wechat_native, alipay_agreement, wechat_contract';


--
-- Name: COLUMN subscriptions.auto_renew; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.auto_renew IS 'Whether subscription auto-renews';


--
-- Name: COLUMN subscriptions.seat_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.seat_count IS 'Number of seats purchased';


--
-- Name: COLUMN subscriptions.canceled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.canceled_at IS 'When subscription was canceled';


--
-- Name: COLUMN subscriptions.cancel_at_period_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'Cancel at end of current period';


--
-- Name: COLUMN subscriptions.frozen_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.frozen_at IS 'When subscription was frozen due to non-payment';


--
-- Name: COLUMN subscriptions.downgrade_to_plan; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.downgrade_to_plan IS 'Plan to downgrade to at period end';


--
-- Name: COLUMN subscriptions.next_billing_cycle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.next_billing_cycle IS 'Billing cycle for next period (if changing)';


--
-- Name: COLUMN subscriptions.lemonsqueezy_customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.lemonsqueezy_customer_id IS 'LemonSqueezy customer ID';


--
-- Name: COLUMN subscriptions.lemonsqueezy_subscription_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.lemonsqueezy_subscription_id IS 'LemonSqueezy subscription ID';


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: support_ticket_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_attachments (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    message_id bigint,
    uploader_id bigint NOT NULL,
    original_name character varying(255) NOT NULL,
    storage_key character varying(500) NOT NULL,
    mime_type character varying(100) NOT NULL,
    size bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_ticket_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_ticket_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_ticket_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_ticket_attachments_id_seq OWNED BY public.support_ticket_attachments.id;


--
-- Name: support_ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_messages (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    user_id bigint NOT NULL,
    content text NOT NULL,
    is_admin_reply boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_ticket_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_ticket_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_ticket_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_ticket_messages_id_seq OWNED BY public.support_ticket_messages.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(50) DEFAULT 'other'::character varying NOT NULL,
    status character varying(50) DEFAULT 'open'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    assigned_admin_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: system_admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_admin_audit_logs (
    id bigint NOT NULL,
    admin_user_id bigint NOT NULL,
    action character varying(100) NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id bigint NOT NULL,
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE system_admin_audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_admin_audit_logs IS 'Audit log for all system administrator actions';


--
-- Name: system_admin_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_admin_audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_admin_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_admin_audit_logs_id_seq OWNED BY public.system_admin_audit_logs.id;


--
-- Name: ticket_assignees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_assignees (
    ticket_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    user_id bigint NOT NULL,
    content text NOT NULL,
    parent_id bigint,
    mentions jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_comments_id_seq OWNED BY public.ticket_comments.id;


--
-- Name: ticket_commits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_commits (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    repository_id bigint NOT NULL,
    pod_id bigint,
    commit_sha character varying(40) NOT NULL,
    commit_message text,
    commit_url text,
    author_name character varying(255),
    author_email character varying(255),
    committed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_commits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_commits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_commits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_commits_id_seq OWNED BY public.ticket_commits.id;


--
-- Name: ticket_external_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_external_links (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    platform_type character varying(32) NOT NULL,
    source_id character varying(255),
    external_id character varying(255) NOT NULL,
    external_url character varying(1000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE ticket_external_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ticket_external_links IS 'Idempotency map from external platform issues to AgentsMesh tickets; UNIQUE(org,platform,external_id) prevents duplicate sync.';


--
-- Name: ticket_external_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_external_links_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_external_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_external_links_id_seq OWNED BY public.ticket_external_links.id;


--
-- Name: ticket_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_labels (
    ticket_id bigint NOT NULL,
    label_id bigint NOT NULL
);


--
-- Name: ticket_merge_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_merge_requests (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    ticket_id bigint,
    pod_id bigint,
    mr_iid integer NOT NULL,
    mr_url text NOT NULL,
    source_branch character varying(255) NOT NULL,
    target_branch character varying(255) DEFAULT 'main'::character varying NOT NULL,
    title character varying(500),
    state character varying(50) DEFAULT 'opened'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pipeline_status character varying(50),
    pipeline_id bigint,
    pipeline_url text,
    merge_commit_sha character varying(40),
    merged_at timestamp with time zone,
    merged_by_id bigint,
    last_synced_at timestamp with time zone,
    repository_id bigint
);


--
-- Name: ticket_merge_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_merge_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_merge_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_merge_requests_id_seq OWNED BY public.ticket_merge_requests.id;


--
-- Name: ticket_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_relations (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    source_ticket_id bigint NOT NULL,
    target_ticket_id bigint NOT NULL,
    relation_type character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_relations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_relations_id_seq OWNED BY public.ticket_relations.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    number integer NOT NULL,
    slug character varying(50) NOT NULL,
    title character varying(500) NOT NULL,
    content text,
    status character varying(50) DEFAULT 'backlog'::character varying NOT NULL,
    priority character varying(50) DEFAULT 'none'::character varying NOT NULL,
    due_date timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    repository_id bigint,
    reporter_id bigint NOT NULL,
    parent_ticket_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    severity character varying(20),
    estimate integer,
    content_block_id uuid
);


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: token_quotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_quotas (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    user_id bigint,
    model character varying(200),
    limit_tokens bigint NOT NULL,
    period character varying(20) DEFAULT 'total'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT token_quotas_limit_ck CHECK ((limit_tokens >= 0)),
    CONSTRAINT token_quotas_period_ck CHECK (((period)::text = ANY ((ARRAY['total'::character varying, 'monthly'::character varying])::text[])))
);


--
-- Name: token_quotas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.token_quotas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: token_quotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.token_quotas_id_seq OWNED BY public.token_quotas.id;


--
-- Name: token_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_usages (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    pod_id bigint,
    pod_key character varying(100) NOT NULL,
    user_id bigint,
    runner_id bigint,
    agent_slug character varying(50) NOT NULL,
    model character varying(100),
    input_tokens bigint DEFAULT 0 NOT NULL,
    output_tokens bigint DEFAULT 0 NOT NULL,
    cache_creation_tokens bigint DEFAULT 0 NOT NULL,
    cache_read_tokens bigint DEFAULT 0 NOT NULL,
    session_started_at timestamp with time zone,
    session_ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: token_usages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.token_usages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: token_usages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.token_usages_id_seq OWNED BY public.token_usages.id;


--
-- Name: usage_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_records (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    usage_type character varying(50) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usage_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usage_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usage_records_id_seq OWNED BY public.usage_records.id;


--
-- Name: user_agent_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_agent_configs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    config_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_slug character varying(100)
);


--
-- Name: TABLE user_agent_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_agent_configs IS 'Stores user personal agent runtime configurations';


--
-- Name: COLUMN user_agent_configs.config_values; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_agent_configs.config_values IS 'JSONB storing runtime config like model, permission_mode, think_level etc.';


--
-- Name: user_agent_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_agent_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_agent_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_agent_configs_id_seq OWNED BY public.user_agent_configs.id;


--
-- Name: user_git_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_git_credentials (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    credential_type character varying(20) NOT NULL,
    repository_provider_id bigint,
    pat_encrypted text,
    public_key text,
    private_key_encrypted text,
    fingerprint character varying(255),
    host_pattern character varying(255),
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_credential_type CHECK (((credential_type)::text = ANY ((ARRAY['runner_local'::character varying, 'oauth'::character varying, 'pat'::character varying, 'ssh_key'::character varying])::text[])))
);


--
-- Name: TABLE user_git_credentials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_git_credentials IS 'User Git credentials for Git operations. SSH Key is a credential type, not a separate concept.';


--
-- Name: user_git_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_git_credentials_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_git_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_git_credentials_id_seq OWNED BY public.user_git_credentials.id;


--
-- Name: user_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identities (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    provider character varying(50) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    provider_username character varying(255),
    access_token_encrypted text,
    refresh_token_encrypted text,
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_identities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_identities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_identities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_identities_id_seq OWNED BY public.user_identities.id;


--
-- Name: user_repository_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_repository_providers (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    provider_type character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    base_url character varying(255) NOT NULL,
    client_id character varying(255),
    client_secret_encrypted text,
    bot_token_encrypted text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    identity_id bigint
);


--
-- Name: TABLE user_repository_providers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_repository_providers IS 'User-owned repository providers for importing repositories. Replaces organization-level git_providers.';


--
-- Name: user_repository_providers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_repository_providers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_repository_providers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_repository_providers_id_seq OWNED BY public.user_repository_providers.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    name character varying(255),
    avatar_url text,
    password_hash character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_email_verified boolean DEFAULT false NOT NULL,
    email_verification_token character varying(255),
    email_verification_expires_at timestamp with time zone,
    password_reset_token character varying(255),
    password_reset_expires_at timestamp with time zone,
    default_git_credential_id bigint,
    is_system_admin boolean DEFAULT false NOT NULL,
    CONSTRAINT users_username_format CHECK ((((username)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length((username)::text) >= 2) AND (char_length((username)::text) <= 100))))
);


--
-- Name: COLUMN users.is_system_admin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.is_system_admin IS 'Whether the user is a system administrator with full platform access';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: virtual_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.virtual_api_keys (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(100) NOT NULL,
    key_prefix character varying(20) NOT NULL,
    key_hash character varying(64) NOT NULL,
    token_budget bigint,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model_resource_id bigint NOT NULL,
    CONSTRAINT virtual_api_keys_status_ck CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'revoked'::character varying, 'exhausted'::character varying])::text[])))
);


--
-- Name: virtual_api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.virtual_api_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: virtual_api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.virtual_api_keys_id_seq OWNED BY public.virtual_api_keys.id;


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id bigint NOT NULL,
    event_id character varying(255) NOT NULL,
    provider character varying(50) NOT NULL,
    event_type character varying(100) NOT NULL,
    processed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.webhook_events IS 'Stores processed webhook event IDs for idempotency';


--
-- Name: COLUMN webhook_events.event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_events.event_id IS 'Unique event ID from the payment provider';


--
-- Name: COLUMN webhook_events.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_events.provider IS 'Payment provider name (stripe, lemonsqueezy, etc.)';


--
-- Name: COLUMN webhook_events.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_events.event_type IS 'Type of webhook event';


--
-- Name: COLUMN webhook_events.processed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.webhook_events.processed_at IS 'When the event was processed';


--
-- Name: webhook_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webhook_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhook_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webhook_events_id_seq OWNED BY public.webhook_events.id;


--
-- Name: worker_spec_dependency_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_spec_dependency_artifacts (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    worker_spec_snapshot_id bigint NOT NULL,
    artifact_json jsonb NOT NULL,
    artifact_digest text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worker_spec_dependency_artifacts_digest CHECK ((artifact_digest ~ '^sha256:[0-9a-f]{64}$'::text)),
    CONSTRAINT worker_spec_dependency_artifacts_object CHECK ((jsonb_typeof(artifact_json) = 'object'::text)),
    CONSTRAINT worker_spec_dependency_artifacts_org_matches CHECK (((artifact_json ->> 'organization_id'::text) = (organization_id)::text)),
    CONSTRAINT worker_spec_dependency_artifacts_org_positive CHECK ((organization_id > 0)),
    CONSTRAINT worker_spec_dependency_artifacts_snapshot_positive CHECK ((worker_spec_snapshot_id > 0)),
    CONSTRAINT worker_spec_dependency_artifacts_version_v1 CHECK (((artifact_json ->> 'version'::text) = '1'::text))
);


--
-- Name: worker_spec_dependency_artifacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_spec_dependency_artifacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_spec_dependency_artifacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_spec_dependency_artifacts_id_seq OWNED BY public.worker_spec_dependency_artifacts.id;


--
-- Name: worker_spec_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_spec_snapshots (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    version smallint NOT NULL,
    spec_json jsonb NOT NULL,
    summary_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worker_spec_snapshots_model_binding_consistent CHECK (COALESCE(((spec_json #> '{runtime,model_binding}'::text[]) = (summary_json -> 'model_binding'::text)), false)),
    CONSTRAINT worker_spec_snapshots_organization_positive CHECK ((organization_id > 0)),
    CONSTRAINT worker_spec_snapshots_spec_model_binding_valid CHECK (public.worker_spec_model_binding_is_valid((spec_json #> '{runtime,model_binding}'::text[]))),
    CONSTRAINT worker_spec_snapshots_spec_object CHECK ((jsonb_typeof(spec_json) = 'object'::text)),
    CONSTRAINT worker_spec_snapshots_spec_version_matches CHECK (COALESCE(((jsonb_typeof((spec_json -> 'version'::text)) = 'number'::text) AND ((spec_json ->> 'version'::text) = (version)::text)), false)),
    CONSTRAINT worker_spec_snapshots_summary_model_binding_valid CHECK (public.worker_spec_model_binding_is_valid((summary_json -> 'model_binding'::text))),
    CONSTRAINT worker_spec_snapshots_summary_object CHECK ((jsonb_typeof(summary_json) = 'object'::text)),
    CONSTRAINT worker_spec_snapshots_summary_version_matches CHECK (COALESCE(((jsonb_typeof((summary_json -> 'version'::text)) = 'number'::text) AND ((summary_json ->> 'version'::text) = (version)::text)), false)),
    CONSTRAINT worker_spec_snapshots_version_v1 CHECK ((version = 1))
);


--
-- Name: worker_spec_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_spec_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_spec_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_spec_snapshots_id_seq OWNED BY public.worker_spec_snapshots.id;


--
-- Name: workflow_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_runs (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    workflow_id bigint NOT NULL,
    run_number integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    pod_key character varying(100),
    autopilot_controller_key character varying(100),
    trigger_type character varying(20) NOT NULL,
    trigger_source character varying(255),
    trigger_params jsonb DEFAULT '{}'::jsonb,
    resolved_prompt text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_sec integer,
    exit_summary text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    orchestration_resource_id bigint,
    orchestration_resource_revision bigint,
    worker_spec_snapshot_id bigint,
    execution_manifest jsonb,
    CONSTRAINT workflow_runs_execution_manifest_check CHECK ((((execution_manifest IS NULL) AND (finished_at IS NOT NULL)) OR ((orchestration_resource_id IS NOT NULL) AND (execution_manifest IS NOT NULL) AND (jsonb_typeof(execution_manifest) = 'object'::text) AND (execution_manifest @> '{"version": 1}'::jsonb) AND
CASE
    WHEN ((jsonb_typeof((execution_manifest -> 'organization_id'::text)) = 'number'::text) AND ((execution_manifest ->> 'organization_id'::text) ~ '^[0-9]+$'::text)) THEN (((((execution_manifest ->> 'organization_id'::text))::numeric >= (1)::numeric) AND (((execution_manifest ->> 'organization_id'::text))::numeric <= ('9223372036854775807'::bigint)::numeric)) AND (((execution_manifest ->> 'organization_id'::text))::numeric = (organization_id)::numeric))
    ELSE false
END AND (jsonb_typeof((execution_manifest -> 'workflow_name'::text)) = 'string'::text) AND ((execution_manifest ->> 'workflow_name'::text) <> ''::text) AND (jsonb_typeof((execution_manifest -> 'workflow_slug'::text)) = 'string'::text) AND ((execution_manifest ->> 'workflow_slug'::text) <> ''::text) AND
CASE
    WHEN ((jsonb_typeof((execution_manifest -> 'created_by_id'::text)) = 'number'::text) AND ((execution_manifest ->> 'created_by_id'::text) ~ '^[0-9]+$'::text)) THEN ((((execution_manifest ->> 'created_by_id'::text))::numeric >= (1)::numeric) AND (((execution_manifest ->> 'created_by_id'::text))::numeric <= ('9223372036854775807'::bigint)::numeric))
    ELSE false
END AND (jsonb_typeof((execution_manifest -> 'execution_mode'::text)) = 'string'::text) AND ((execution_manifest ->> 'execution_mode'::text) = ANY (ARRAY['direct'::text, 'autopilot'::text])) AND (jsonb_typeof((execution_manifest -> 'autopilot'::text)) = 'object'::text) AND (jsonb_typeof((execution_manifest -> 'sandbox_strategy'::text)) = 'string'::text) AND ((execution_manifest ->> 'sandbox_strategy'::text) = ANY (ARRAY['fresh'::text, 'persistent'::text])) AND (jsonb_typeof((execution_manifest -> 'session_persistence'::text)) = 'boolean'::text) AND ((NOT (execution_manifest ? 'source_pod_key'::text)) OR (jsonb_typeof((execution_manifest -> 'source_pod_key'::text)) = 'string'::text)) AND ((NOT (execution_manifest ? 'callback_url'::text)) OR (jsonb_typeof((execution_manifest -> 'callback_url'::text)) = 'string'::text)) AND ((NOT (execution_manifest ? 'ticket_id'::text)) OR ((execution_manifest -> 'ticket_id'::text) = 'null'::jsonb) OR
CASE
    WHEN ((jsonb_typeof((execution_manifest -> 'ticket_id'::text)) = 'number'::text) AND ((execution_manifest ->> 'ticket_id'::text) ~ '^[0-9]+$'::text)) THEN ((((execution_manifest ->> 'ticket_id'::text))::numeric >= (1)::numeric) AND (((execution_manifest ->> 'ticket_id'::text))::numeric <= ('9223372036854775807'::bigint)::numeric))
    ELSE false
END) AND
CASE
    WHEN ((jsonb_typeof((execution_manifest -> 'max_retained_runs'::text)) = 'number'::text) AND ((execution_manifest ->> 'max_retained_runs'::text) ~ '^[0-9]+$'::text)) THEN ((((execution_manifest ->> 'max_retained_runs'::text))::numeric >= (0)::numeric) AND (((execution_manifest ->> 'max_retained_runs'::text))::numeric <= (2147483647)::numeric))
    ELSE false
END AND
CASE
    WHEN ((jsonb_typeof((execution_manifest -> 'timeout_minutes'::text)) = 'number'::text) AND ((execution_manifest ->> 'timeout_minutes'::text) ~ '^[0-9]+$'::text)) THEN ((((execution_manifest ->> 'timeout_minutes'::text))::numeric >= (1)::numeric) AND (((execution_manifest ->> 'timeout_minutes'::text))::numeric <= (2147483647)::numeric))
    ELSE false
END AND
CASE
    WHEN ((jsonb_typeof((execution_manifest -> 'idle_timeout_seconds'::text)) = 'number'::text) AND ((execution_manifest ->> 'idle_timeout_seconds'::text) ~ '^[0-9]+$'::text)) THEN ((((execution_manifest ->> 'idle_timeout_seconds'::text))::numeric >= (0)::numeric) AND (((execution_manifest ->> 'idle_timeout_seconds'::text))::numeric <= (2147483647)::numeric))
    ELSE false
END AND (((execution_manifest ->> 'sandbox_strategy'::text) <> 'fresh'::text) OR (((execution_manifest -> 'session_persistence'::text) = 'false'::jsonb) AND (COALESCE((execution_manifest ->> 'source_pod_key'::text), ''::text) = ''::text)))))),
    CONSTRAINT workflow_runs_orchestration_mode_check CHECK ((((orchestration_resource_id IS NULL) AND (orchestration_resource_revision IS NULL) AND (worker_spec_snapshot_id IS NULL)) OR ((orchestration_resource_id IS NOT NULL) AND (orchestration_resource_revision > 0) AND (worker_spec_snapshot_id IS NOT NULL))))
);


--
-- Name: workflow_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workflow_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workflow_runs_id_seq OWNED BY public.workflow_runs.id;


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    permission_mode character varying(50) DEFAULT 'bypassPermissions'::character varying NOT NULL,
    prompt_template text NOT NULL,
    prompt_variables jsonb DEFAULT '{}'::jsonb,
    repository_id bigint,
    runner_id bigint,
    branch_name character varying(255),
    ticket_id bigint,
    config_overrides jsonb DEFAULT '{}'::jsonb,
    execution_mode character varying(20) DEFAULT 'autopilot'::character varying NOT NULL,
    cron_expression character varying(100),
    autopilot_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    callback_url character varying(500),
    status character varying(20) DEFAULT 'enabled'::character varying NOT NULL,
    sandbox_strategy character varying(20) DEFAULT 'persistent'::character varying NOT NULL,
    session_persistence boolean DEFAULT true NOT NULL,
    concurrency_policy character varying(20) DEFAULT 'skip'::character varying NOT NULL,
    max_concurrent_runs integer DEFAULT 1 NOT NULL,
    timeout_minutes integer DEFAULT 60 NOT NULL,
    sandbox_path character varying(500),
    last_pod_key character varying(100),
    created_by_id bigint NOT NULL,
    total_runs integer DEFAULT 0 NOT NULL,
    successful_runs integer DEFAULT 0 NOT NULL,
    failed_runs integer DEFAULT 0 NOT NULL,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_retained_runs integer DEFAULT 0 NOT NULL,
    idle_timeout_sec integer DEFAULT 30 NOT NULL,
    agent_slug character varying(100),
    used_env_bundles text[] DEFAULT ARRAY[]::text[] NOT NULL,
    model_resource_id bigint,
    orchestration_resource_id bigint,
    orchestration_resource_revision bigint,
    worker_spec_snapshot_id bigint,
    CONSTRAINT workflows_orchestration_mode_check CHECK ((((orchestration_resource_id IS NULL) AND (orchestration_resource_revision IS NULL) AND (worker_spec_snapshot_id IS NULL)) OR ((orchestration_resource_id IS NOT NULL) AND (orchestration_resource_revision > 0) AND (worker_spec_snapshot_id IS NOT NULL))))
);


--
-- Name: COLUMN workflows.used_env_bundles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflows.used_env_bundles IS 'Ordered EnvBundle names attached to every Workflow run.';


--
-- Name: workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workflows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workflows_id_seq OWNED BY public.workflows.id;


--
-- Name: marketplace_catalog_item_versions id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_item_versions ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_catalog_item_versions_id_seq'::regclass);


--
-- Name: marketplace_catalog_items id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_items ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_catalog_items_id_seq'::regclass);


--
-- Name: marketplace_domains id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_domains ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_domains_id_seq'::regclass);


--
-- Name: marketplace_listing_versions id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_listing_versions_id_seq'::regclass);


--
-- Name: marketplace_listings id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_listings_id_seq'::regclass);


--
-- Name: marketplace_publishers id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_publishers ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_publishers_id_seq'::regclass);


--
-- Name: marketplace_quota_plans id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_plans ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_quota_plans_id_seq'::regclass);


--
-- Name: marketplace_spaces id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_spaces ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_spaces_id_seq'::regclass);


--
-- Name: marketplace_taxonomy_tags id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_taxonomy_tags ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplace_taxonomy_tags_id_seq'::regclass);


--
-- Name: marketplaces id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplaces ALTER COLUMN id SET DEFAULT nextval('marketplace.marketplaces_id_seq'::regclass);


--
-- Name: ai_models id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models ALTER COLUMN id SET DEFAULT nextval('public.ai_models_id_seq'::regclass);


--
-- Name: ai_resource_migration_map id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_resource_migration_map ALTER COLUMN id SET DEFAULT nextval('public.ai_resource_migration_map_id_seq'::regclass);


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: autopilot_controllers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_controllers ALTER COLUMN id SET DEFAULT nextval('public.ralph_pods_id_seq'::regclass);


--
-- Name: autopilot_iterations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_iterations ALTER COLUMN id SET DEFAULT nextval('public.ralph_iterations_id_seq'::regclass);


--
-- Name: block_ops id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_ops ALTER COLUMN id SET DEFAULT nextval('public.block_ops_id_seq'::regclass);


--
-- Name: block_refs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_refs ALTER COLUMN id SET DEFAULT nextval('public.block_refs_id_seq'::regclass);


--
-- Name: channel_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_access ALTER COLUMN id SET DEFAULT nextval('public.channel_access_id_seq'::regclass);


--
-- Name: channel_message_edits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_message_edits ALTER COLUMN id SET DEFAULT nextval('public.channel_message_edits_id_seq'::regclass);


--
-- Name: channel_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages ALTER COLUMN id SET DEFAULT nextval('public.channel_messages_id_seq'::regclass);


--
-- Name: channel_pods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_pods ALTER COLUMN id SET DEFAULT nextval('public.channel_pods_id_seq'::regclass);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: coordinator_executions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinator_executions ALTER COLUMN id SET DEFAULT nextval('public.coordinator_executions_id_seq'::regclass);


--
-- Name: coordinator_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinator_projects ALTER COLUMN id SET DEFAULT nextval('public.coordinator_projects_id_seq'::regclass);


--
-- Name: env_bundles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.env_bundles ALTER COLUMN id SET DEFAULT nextval('public.env_bundles_id_seq'::regclass);


--
-- Name: execution_clusters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_clusters ALTER COLUMN id SET DEFAULT nextval('public.execution_clusters_id_seq'::regclass);


--
-- Name: expert_market_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications ALTER COLUMN id SET DEFAULT nextval('public.expert_market_applications_id_seq'::regclass);


--
-- Name: expert_market_releases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases ALTER COLUMN id SET DEFAULT nextval('public.expert_market_releases_id_seq'::regclass);


--
-- Name: experts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experts ALTER COLUMN id SET DEFAULT nextval('public.experts_id_seq'::regclass);


--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: git_providers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.git_providers ALTER COLUMN id SET DEFAULT nextval('public.git_providers_id_seq'::regclass);


--
-- Name: goal_loops id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_loops ALTER COLUMN id SET DEFAULT nextval('public.goal_loops_id_seq'::regclass);


--
-- Name: identifier_backfill_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identifier_backfill_audit ALTER COLUMN id SET DEFAULT nextval('public.identifier_backfill_audit_id_seq'::regclass);


--
-- Name: im_channel_connections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_channel_connections ALTER COLUMN id SET DEFAULT nextval('public.im_channel_connections_id_seq'::regclass);


--
-- Name: im_identity_bindings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_identity_bindings ALTER COLUMN id SET DEFAULT nextval('public.im_identity_bindings_id_seq'::regclass);


--
-- Name: im_route_bindings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_route_bindings ALTER COLUMN id SET DEFAULT nextval('public.im_route_bindings_id_seq'::regclass);


--
-- Name: im_thread_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_thread_mappings ALTER COLUMN id SET DEFAULT nextval('public.im_thread_mappings_id_seq'::regclass);


--
-- Name: installed_mcp_servers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_mcp_servers ALTER COLUMN id SET DEFAULT nextval('public.installed_mcp_servers_id_seq'::regclass);


--
-- Name: installed_skills id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_skills ALTER COLUMN id SET DEFAULT nextval('public.installed_skills_id_seq'::regclass);


--
-- Name: invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations ALTER COLUMN id SET DEFAULT nextval('public.invitations_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: knowledge_base_agent_mounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_agent_mounts ALTER COLUMN id SET DEFAULT nextval('public.knowledge_base_agent_mounts_id_seq'::regclass);


--
-- Name: knowledge_bases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases ALTER COLUMN id SET DEFAULT nextval('public.knowledge_bases_id_seq'::regclass);


--
-- Name: labels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels ALTER COLUMN id SET DEFAULT nextval('public.labels_id_seq'::regclass);


--
-- Name: licenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses ALTER COLUMN id SET DEFAULT nextval('public.licenses_id_seq'::regclass);


--
-- Name: mcp_market_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_market_items ALTER COLUMN id SET DEFAULT nextval('public.mcp_market_items_id_seq'::regclass);


--
-- Name: model_resources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_resources ALTER COLUMN id SET DEFAULT nextval('public.model_resources_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: orchestration_resource_revisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions ALTER COLUMN id SET DEFAULT nextval('public.orchestration_resource_revisions_id_seq'::regclass);


--
-- Name: orchestration_resources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources ALTER COLUMN id SET DEFAULT nextval('public.orchestration_resources_id_seq'::regclass);


--
-- Name: orchestration_worker_launches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches ALTER COLUMN id SET DEFAULT nextval('public.orchestration_worker_launches_id_seq'::regclass);


--
-- Name: organization_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members ALTER COLUMN id SET DEFAULT nextval('public.organization_members_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: payment_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders ALTER COLUMN id SET DEFAULT nextval('public.payment_orders_id_seq'::regclass);


--
-- Name: payment_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN id SET DEFAULT nextval('public.payment_transactions_id_seq'::regclass);


--
-- Name: pending_runner_commands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_runner_commands ALTER COLUMN id SET DEFAULT nextval('public.pending_runner_commands_id_seq'::regclass);


--
-- Name: permission_policies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_policies ALTER COLUMN id SET DEFAULT nextval('public.permission_policies_id_seq'::regclass);


--
-- Name: plan_prices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices ALTER COLUMN id SET DEFAULT nextval('public.plan_prices_id_seq'::regclass);


--
-- Name: pod_bindings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_bindings ALTER COLUMN id SET DEFAULT nextval('public.pod_bindings_id_seq'::regclass);


--
-- Name: pod_config_revisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_config_revisions ALTER COLUMN id SET DEFAULT nextval('public.pod_config_revisions_id_seq'::regclass);


--
-- Name: pods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods ALTER COLUMN id SET DEFAULT nextval('public.pods_id_seq'::regclass);


--
-- Name: promo_code_redemptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_redemptions ALTER COLUMN id SET DEFAULT nextval('public.promo_code_redemptions_id_seq'::regclass);


--
-- Name: promo_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes ALTER COLUMN id SET DEFAULT nextval('public.promo_codes_id_seq'::regclass);


--
-- Name: provider_connections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_connections ALTER COLUMN id SET DEFAULT nextval('public.provider_connections_id_seq'::regclass);


--
-- Name: repositories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repositories ALTER COLUMN id SET DEFAULT nextval('public.repositories_id_seq'::regclass);


--
-- Name: resource_grants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_grants ALTER COLUMN id SET DEFAULT nextval('public.resource_grants_id_seq'::regclass);


--
-- Name: runner_certificates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_certificates ALTER COLUMN id SET DEFAULT nextval('public.runner_certificates_id_seq'::regclass);


--
-- Name: runner_grpc_registration_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_grpc_registration_tokens ALTER COLUMN id SET DEFAULT nextval('public.runner_registration_tokens_id_seq'::regclass);


--
-- Name: runner_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_logs ALTER COLUMN id SET DEFAULT nextval('public.runner_logs_id_seq'::regclass);


--
-- Name: runner_pending_auths id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_pending_auths ALTER COLUMN id SET DEFAULT nextval('public.runner_pending_auths_id_seq'::regclass);


--
-- Name: runner_reactivation_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_reactivation_tokens ALTER COLUMN id SET DEFAULT nextval('public.runner_reactivation_tokens_id_seq'::regclass);


--
-- Name: runners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runners ALTER COLUMN id SET DEFAULT nextval('public.runners_id_seq'::regclass);


--
-- Name: skills id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills ALTER COLUMN id SET DEFAULT nextval('public.authored_skills_id_seq'::regclass);


--
-- Name: sso_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configs ALTER COLUMN id SET DEFAULT nextval('public.sso_configs_id_seq'::regclass);


--
-- Name: subscription_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans ALTER COLUMN id SET DEFAULT nextval('public.subscription_plans_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: support_ticket_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments ALTER COLUMN id SET DEFAULT nextval('public.support_ticket_attachments_id_seq'::regclass);


--
-- Name: support_ticket_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages ALTER COLUMN id SET DEFAULT nextval('public.support_ticket_messages_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: system_admin_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_admin_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.system_admin_audit_logs_id_seq'::regclass);


--
-- Name: ticket_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments ALTER COLUMN id SET DEFAULT nextval('public.ticket_comments_id_seq'::regclass);


--
-- Name: ticket_commits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_commits ALTER COLUMN id SET DEFAULT nextval('public.ticket_commits_id_seq'::regclass);


--
-- Name: ticket_external_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_external_links ALTER COLUMN id SET DEFAULT nextval('public.ticket_external_links_id_seq'::regclass);


--
-- Name: ticket_merge_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_merge_requests ALTER COLUMN id SET DEFAULT nextval('public.ticket_merge_requests_id_seq'::regclass);


--
-- Name: ticket_relations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations ALTER COLUMN id SET DEFAULT nextval('public.ticket_relations_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: token_quotas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_quotas ALTER COLUMN id SET DEFAULT nextval('public.token_quotas_id_seq'::regclass);


--
-- Name: token_usages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usages ALTER COLUMN id SET DEFAULT nextval('public.token_usages_id_seq'::regclass);


--
-- Name: usage_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records ALTER COLUMN id SET DEFAULT nextval('public.usage_records_id_seq'::regclass);


--
-- Name: user_agent_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_agent_configs ALTER COLUMN id SET DEFAULT nextval('public.user_agent_configs_id_seq'::regclass);


--
-- Name: user_git_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_git_credentials ALTER COLUMN id SET DEFAULT nextval('public.user_git_credentials_id_seq'::regclass);


--
-- Name: user_identities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities ALTER COLUMN id SET DEFAULT nextval('public.user_identities_id_seq'::regclass);


--
-- Name: user_repository_providers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_repository_providers ALTER COLUMN id SET DEFAULT nextval('public.user_repository_providers_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: virtual_api_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.virtual_api_keys ALTER COLUMN id SET DEFAULT nextval('public.virtual_api_keys_id_seq'::regclass);


--
-- Name: webhook_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events ALTER COLUMN id SET DEFAULT nextval('public.webhook_events_id_seq'::regclass);


--
-- Name: worker_spec_dependency_artifacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_dependency_artifacts ALTER COLUMN id SET DEFAULT nextval('public.worker_spec_dependency_artifacts_id_seq'::regclass);


--
-- Name: worker_spec_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_snapshots ALTER COLUMN id SET DEFAULT nextval('public.worker_spec_snapshots_id_seq'::regclass);


--
-- Name: workflow_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs ALTER COLUMN id SET DEFAULT nextval('public.workflow_runs_id_seq'::regclass);


--
-- Name: workflows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows ALTER COLUMN id SET DEFAULT nextval('public.workflows_id_seq'::regclass);


--
-- Name: marketplace_audit_events marketplace_audit_events_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_audit_events
    ADD CONSTRAINT marketplace_audit_events_pkey PRIMARY KEY (id);


--
-- Name: marketplace_catalog_item_versions marketplace_catalog_item_vers_catalog_item_id_content_diges_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_item_versions
    ADD CONSTRAINT marketplace_catalog_item_vers_catalog_item_id_content_diges_key UNIQUE (catalog_item_id, content_digest);


--
-- Name: marketplace_catalog_item_versions marketplace_catalog_item_versions_catalog_item_id_version_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_item_versions
    ADD CONSTRAINT marketplace_catalog_item_versions_catalog_item_id_version_key UNIQUE (catalog_item_id, version);


--
-- Name: marketplace_catalog_item_versions marketplace_catalog_item_versions_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_item_versions
    ADD CONSTRAINT marketplace_catalog_item_versions_pkey PRIMARY KEY (id);


--
-- Name: marketplace_catalog_items marketplace_catalog_items_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_items
    ADD CONSTRAINT marketplace_catalog_items_pkey PRIMARY KEY (id);


--
-- Name: marketplace_catalog_items marketplace_catalog_items_platform_resource_type_platform_r_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_items
    ADD CONSTRAINT marketplace_catalog_items_platform_resource_type_platform_r_key UNIQUE (platform_resource_type, platform_resource_id);


--
-- Name: marketplace_catalog_items marketplace_catalog_items_publisher_id_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_items
    ADD CONSTRAINT marketplace_catalog_items_publisher_id_slug_key UNIQUE (publisher_id, slug);


--
-- Name: marketplace_domains marketplace_domains_host_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_domains
    ADD CONSTRAINT marketplace_domains_host_key UNIQUE (host);


--
-- Name: marketplace_domains marketplace_domains_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_domains
    ADD CONSTRAINT marketplace_domains_pkey PRIMARY KEY (id);


--
-- Name: marketplace_entitlements marketplace_entitlements_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_entitlements
    ADD CONSTRAINT marketplace_entitlements_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_entitlements marketplace_entitlements_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_entitlements
    ADD CONSTRAINT marketplace_entitlements_pkey PRIMARY KEY (id);


--
-- Name: marketplace_installation_operations marketplace_installation_operations_installation_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installation_operations
    ADD CONSTRAINT marketplace_installation_operations_installation_id_id_key UNIQUE (installation_id, id);


--
-- Name: marketplace_installation_operations marketplace_installation_operations_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installation_operations
    ADD CONSTRAINT marketplace_installation_operations_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_installation_operations marketplace_installation_operations_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installation_operations
    ADD CONSTRAINT marketplace_installation_operations_pkey PRIMARY KEY (id);


--
-- Name: marketplace_installations marketplace_installations_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT marketplace_installations_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_installations marketplace_installations_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT marketplace_installations_pkey PRIMARY KEY (id);


--
-- Name: marketplace_listing_spaces marketplace_listing_spaces_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_spaces
    ADD CONSTRAINT marketplace_listing_spaces_pkey PRIMARY KEY (listing_id, space_id);


--
-- Name: marketplace_listing_version_tags marketplace_listing_version_tags_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_version_tags
    ADD CONSTRAINT marketplace_listing_version_tags_pkey PRIMARY KEY (listing_version_id, taxonomy_tag_id);


--
-- Name: marketplace_listing_versions marketplace_listing_versions_listing_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions
    ADD CONSTRAINT marketplace_listing_versions_listing_id_id_key UNIQUE (listing_id, id);


--
-- Name: marketplace_listing_versions marketplace_listing_versions_listing_id_revision_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions
    ADD CONSTRAINT marketplace_listing_versions_listing_id_revision_key UNIQUE (listing_id, revision);


--
-- Name: marketplace_listing_versions marketplace_listing_versions_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions
    ADD CONSTRAINT marketplace_listing_versions_pkey PRIMARY KEY (id);


--
-- Name: marketplace_listings marketplace_listings_marketplace_id_catalog_item_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT marketplace_listings_marketplace_id_catalog_item_id_key UNIQUE (marketplace_id, catalog_item_id);


--
-- Name: marketplace_listings marketplace_listings_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT marketplace_listings_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_listings marketplace_listings_marketplace_id_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT marketplace_listings_marketplace_id_slug_key UNIQUE (marketplace_id, slug);


--
-- Name: marketplace_listings marketplace_listings_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT marketplace_listings_pkey PRIMARY KEY (id);


--
-- Name: marketplace_publishers marketplace_publishers_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_publishers
    ADD CONSTRAINT marketplace_publishers_pkey PRIMARY KEY (id);


--
-- Name: marketplace_publishers marketplace_publishers_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_publishers
    ADD CONSTRAINT marketplace_publishers_slug_key UNIQUE (slug);


--
-- Name: marketplace_quota_accounts marketplace_quota_accounts_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_accounts
    ADD CONSTRAINT marketplace_quota_accounts_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_quota_accounts marketplace_quota_accounts_marketplace_id_subject_type_subj_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_accounts
    ADD CONSTRAINT marketplace_quota_accounts_marketplace_id_subject_type_subj_key UNIQUE (marketplace_id, subject_type, subject_ref, quota_plan_id);


--
-- Name: marketplace_quota_accounts marketplace_quota_accounts_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_accounts
    ADD CONSTRAINT marketplace_quota_accounts_pkey PRIMARY KEY (id);


--
-- Name: marketplace_quota_ledger_entries marketplace_quota_ledger_entries_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_ledger_entries
    ADD CONSTRAINT marketplace_quota_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: marketplace_quota_plans marketplace_quota_plans_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_plans
    ADD CONSTRAINT marketplace_quota_plans_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_quota_plans marketplace_quota_plans_marketplace_id_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_plans
    ADD CONSTRAINT marketplace_quota_plans_marketplace_id_slug_key UNIQUE (marketplace_id, slug);


--
-- Name: marketplace_quota_plans marketplace_quota_plans_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_plans
    ADD CONSTRAINT marketplace_quota_plans_pkey PRIMARY KEY (id);


--
-- Name: marketplace_quota_reservations marketplace_quota_reservations_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_reservations
    ADD CONSTRAINT marketplace_quota_reservations_pkey PRIMARY KEY (id);


--
-- Name: marketplace_quota_reservations marketplace_quota_reservations_quota_account_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_reservations
    ADD CONSTRAINT marketplace_quota_reservations_quota_account_id_id_key UNIQUE (quota_account_id, id);


--
-- Name: marketplace_spaces marketplace_spaces_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_spaces
    ADD CONSTRAINT marketplace_spaces_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_spaces marketplace_spaces_marketplace_id_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_spaces
    ADD CONSTRAINT marketplace_spaces_marketplace_id_slug_key UNIQUE (marketplace_id, slug);


--
-- Name: marketplace_spaces marketplace_spaces_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_spaces
    ADD CONSTRAINT marketplace_spaces_pkey PRIMARY KEY (id);


--
-- Name: marketplace_taxonomy_tags marketplace_taxonomy_tags_marketplace_id_id_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_taxonomy_tags
    ADD CONSTRAINT marketplace_taxonomy_tags_marketplace_id_id_key UNIQUE (marketplace_id, id);


--
-- Name: marketplace_taxonomy_tags marketplace_taxonomy_tags_marketplace_id_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_taxonomy_tags
    ADD CONSTRAINT marketplace_taxonomy_tags_marketplace_id_slug_key UNIQUE (marketplace_id, slug);


--
-- Name: marketplace_taxonomy_tags marketplace_taxonomy_tags_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_taxonomy_tags
    ADD CONSTRAINT marketplace_taxonomy_tags_pkey PRIMARY KEY (id);


--
-- Name: marketplaces marketplaces_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplaces
    ADD CONSTRAINT marketplaces_pkey PRIMARY KEY (id);


--
-- Name: marketplaces marketplaces_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplaces
    ADD CONSTRAINT marketplaces_slug_key UNIQUE (slug);


--
-- Name: marketplace_catalog_item_versions uq_marketplace_catalog_versions_id_item; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_item_versions
    ADD CONSTRAINT uq_marketplace_catalog_versions_id_item UNIQUE (id, catalog_item_id);


--
-- Name: marketplace_installation_operations uq_marketplace_installation_operations_idempotency; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installation_operations
    ADD CONSTRAINT uq_marketplace_installation_operations_idempotency UNIQUE (idempotency_key);


--
-- Name: marketplace_listings uq_marketplace_listings_id_item; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT uq_marketplace_listings_id_item UNIQUE (id, catalog_item_id);


--
-- Name: marketplace_quota_reservations uq_marketplace_quota_reservations_idempotency; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_reservations
    ADD CONSTRAINT uq_marketplace_quota_reservations_idempotency UNIQUE (idempotency_key);


--
-- Name: agent_sessions agent_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_pkey PRIMARY KEY (id);


--
-- Name: agent_sessions agent_sessions_pod_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_pod_key_key UNIQUE (pod_key);


--
-- Name: agent_workbench_command_receipts agent_workbench_command_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_command_receipts
    ADD CONSTRAINT agent_workbench_command_receipts_pkey PRIMARY KEY (session_id, command_id);


--
-- Name: agent_workbench_events agent_workbench_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_events
    ADD CONSTRAINT agent_workbench_events_pkey PRIMARY KEY (session_id, stream_epoch, sequence);


--
-- Name: agent_workbench_session_states agent_workbench_session_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_session_states
    ADD CONSTRAINT agent_workbench_session_states_pkey PRIMARY KEY (session_id);


--
-- Name: agent_workbench_source_events agent_workbench_source_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_source_events
    ADD CONSTRAINT agent_workbench_source_events_pkey PRIMARY KEY (session_id, stable_event_id);


--
-- Name: agent_workbench_source_events agent_workbench_source_events_session_id_runner_session_epo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_source_events
    ADD CONSTRAINT agent_workbench_source_events_session_id_runner_session_epo_key UNIQUE (session_id, runner_session_epoch, source_sequence);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (slug);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_resource_migration_map ai_resource_migration_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_resource_migration_map
    ADD CONSTRAINT ai_resource_migration_map_pkey PRIMARY KEY (id);


--
-- Name: ai_resource_migration_map ai_resource_migration_map_source_kind_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_resource_migration_map
    ADD CONSTRAINT ai_resource_migration_map_source_kind_source_id_key UNIQUE (source_kind, source_id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_org_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_org_slug_unique UNIQUE (organization_id, slug);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: skills authored_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT authored_skills_pkey PRIMARY KEY (id);


--
-- Name: block_embeddings block_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_embeddings
    ADD CONSTRAINT block_embeddings_pkey PRIMARY KEY (block_id);


--
-- Name: block_ops block_ops_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_ops
    ADD CONSTRAINT block_ops_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: block_ops block_ops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_ops
    ADD CONSTRAINT block_ops_pkey PRIMARY KEY (id);


--
-- Name: block_refs block_refs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_refs
    ADD CONSTRAINT block_refs_pkey PRIMARY KEY (id);


--
-- Name: block_workspaces block_workspaces_organization_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_workspaces
    ADD CONSTRAINT block_workspaces_organization_id_slug_key UNIQUE (organization_id, slug);


--
-- Name: block_workspaces block_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_workspaces
    ADD CONSTRAINT block_workspaces_pkey PRIMARY KEY (id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: channel_access channel_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_access
    ADD CONSTRAINT channel_access_pkey PRIMARY KEY (id);


--
-- Name: channel_members channel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT channel_members_pkey PRIMARY KEY (channel_id, user_id);


--
-- Name: channel_message_edits channel_message_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_message_edits
    ADD CONSTRAINT channel_message_edits_pkey PRIMARY KEY (id);


--
-- Name: channel_messages channel_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_pkey PRIMARY KEY (id);


--
-- Name: channel_pods channel_pods_channel_id_pod_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_pods
    ADD CONSTRAINT channel_pods_channel_id_pod_key_key UNIQUE (channel_id, pod_key);


--
-- Name: channel_pods channel_pods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_pods
    ADD CONSTRAINT channel_pods_pkey PRIMARY KEY (id);


--
-- Name: channel_read_states channel_read_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_read_states
    ADD CONSTRAINT channel_read_states_pkey PRIMARY KEY (channel_id, user_id);


--
-- Name: channels channels_org_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_org_slug_unique UNIQUE (organization_id, slug);


--
-- Name: channels channels_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: conversation_items conversation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_items
    ADD CONSTRAINT conversation_items_pkey PRIMARY KEY (id);


--
-- Name: coordinator_executions coordinator_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinator_executions
    ADD CONSTRAINT coordinator_executions_pkey PRIMARY KEY (id);


--
-- Name: coordinator_projects coordinator_projects_organization_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinator_projects
    ADD CONSTRAINT coordinator_projects_organization_id_slug_key UNIQUE (organization_id, slug);


--
-- Name: coordinator_projects coordinator_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinator_projects
    ADD CONSTRAINT coordinator_projects_pkey PRIMARY KEY (id);


--
-- Name: custom_agents custom_agent_types_organization_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_agents
    ADD CONSTRAINT custom_agent_types_organization_id_slug_key UNIQUE (organization_id, slug);


--
-- Name: custom_agents custom_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_agents
    ADD CONSTRAINT custom_agents_pkey PRIMARY KEY (organization_id, slug);


--
-- Name: env_bundles env_bundles_owner_scope_owner_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.env_bundles
    ADD CONSTRAINT env_bundles_owner_scope_owner_id_name_key UNIQUE (owner_scope, owner_id, name);


--
-- Name: env_bundles env_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.env_bundles
    ADD CONSTRAINT env_bundles_pkey PRIMARY KEY (id);


--
-- Name: execution_clusters execution_clusters_id_organization_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_clusters
    ADD CONSTRAINT execution_clusters_id_organization_unique UNIQUE (id, organization_id);


--
-- Name: execution_clusters execution_clusters_org_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_clusters
    ADD CONSTRAINT execution_clusters_org_slug_unique UNIQUE (organization_id, slug);


--
-- Name: execution_clusters execution_clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_clusters
    ADD CONSTRAINT execution_clusters_pkey PRIMARY KEY (id);


--
-- Name: expert_market_applications expert_market_applications_id_publisher_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications
    ADD CONSTRAINT expert_market_applications_id_publisher_unique UNIQUE (id, publisher_organization_id);


--
-- Name: expert_market_applications expert_market_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications
    ADD CONSTRAINT expert_market_applications_pkey PRIMARY KEY (id);


--
-- Name: expert_market_applications expert_market_applications_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications
    ADD CONSTRAINT expert_market_applications_slug_unique UNIQUE (slug);


--
-- Name: expert_market_applications expert_market_applications_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications
    ADD CONSTRAINT expert_market_applications_source_unique UNIQUE (publisher_organization_id, source_expert_id);


--
-- Name: expert_market_releases expert_market_releases_application_id_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases
    ADD CONSTRAINT expert_market_releases_application_id_id_unique UNIQUE (application_id, id);


--
-- Name: expert_market_releases expert_market_releases_application_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases
    ADD CONSTRAINT expert_market_releases_application_version_unique UNIQUE (application_id, version);


--
-- Name: expert_market_releases expert_market_releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases
    ADD CONSTRAINT expert_market_releases_pkey PRIMARY KEY (id);


--
-- Name: experts experts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experts
    ADD CONSTRAINT experts_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: git_providers git_providers_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.git_providers
    ADD CONSTRAINT git_providers_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: git_providers git_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.git_providers
    ADD CONSTRAINT git_providers_pkey PRIMARY KEY (id);


--
-- Name: goal_loops goal_loops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_loops
    ADD CONSTRAINT goal_loops_pkey PRIMARY KEY (id);


--
-- Name: identifier_backfill_audit identifier_backfill_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identifier_backfill_audit
    ADD CONSTRAINT identifier_backfill_audit_pkey PRIMARY KEY (id);


--
-- Name: im_channel_connections im_channel_connections_organization_id_provider_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_channel_connections
    ADD CONSTRAINT im_channel_connections_organization_id_provider_name_key UNIQUE (organization_id, provider, name);


--
-- Name: im_channel_connections im_channel_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_channel_connections
    ADD CONSTRAINT im_channel_connections_pkey PRIMARY KEY (id);


--
-- Name: im_identity_bindings im_identity_bindings_connection_id_external_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_identity_bindings
    ADD CONSTRAINT im_identity_bindings_connection_id_external_user_id_key UNIQUE (connection_id, external_user_id);


--
-- Name: im_identity_bindings im_identity_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_identity_bindings
    ADD CONSTRAINT im_identity_bindings_pkey PRIMARY KEY (id);


--
-- Name: im_inbound_dedupe im_inbound_dedupe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_inbound_dedupe
    ADD CONSTRAINT im_inbound_dedupe_pkey PRIMARY KEY (connection_id, external_message_id);


--
-- Name: im_route_bindings im_route_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_route_bindings
    ADD CONSTRAINT im_route_bindings_pkey PRIMARY KEY (id);


--
-- Name: im_thread_mappings im_thread_mappings_connection_id_external_thread_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_thread_mappings
    ADD CONSTRAINT im_thread_mappings_connection_id_external_thread_id_key UNIQUE (connection_id, external_thread_id);


--
-- Name: im_thread_mappings im_thread_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_thread_mappings
    ADD CONSTRAINT im_thread_mappings_pkey PRIMARY KEY (id);


--
-- Name: installed_mcp_servers installed_mcp_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_mcp_servers
    ADD CONSTRAINT installed_mcp_servers_pkey PRIMARY KEY (id);


--
-- Name: installed_skills installed_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_skills
    ADD CONSTRAINT installed_skills_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: invoices invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_agent_mounts knowledge_base_agent_mounts_knowledge_base_id_agent_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_agent_mounts
    ADD CONSTRAINT knowledge_base_agent_mounts_knowledge_base_id_agent_slug_key UNIQUE (knowledge_base_id, agent_slug);


--
-- Name: knowledge_base_agent_mounts knowledge_base_agent_mounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_agent_mounts
    ADD CONSTRAINT knowledge_base_agent_mounts_pkey PRIMARY KEY (id);


--
-- Name: knowledge_bases knowledge_bases_organization_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_organization_id_slug_key UNIQUE (organization_id, slug);


--
-- Name: knowledge_bases knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: labels labels_organization_id_repository_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_organization_id_repository_id_name_key UNIQUE (organization_id, repository_id, name);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_license_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_license_key_key UNIQUE (license_key);


--
-- Name: licenses licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: workflow_runs loop_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT loop_runs_pkey PRIMARY KEY (id);


--
-- Name: workflows loops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT loops_pkey PRIMARY KEY (id);


--
-- Name: mcp_market_items mcp_market_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_market_items
    ADD CONSTRAINT mcp_market_items_pkey PRIMARY KEY (id);


--
-- Name: mcp_market_items mcp_market_items_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_market_items
    ADD CONSTRAINT mcp_market_items_slug_key UNIQUE (slug);


--
-- Name: model_prices model_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_prices
    ADD CONSTRAINT model_prices_pkey PRIMARY KEY (model);


--
-- Name: model_resource_defaults model_resource_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_resource_defaults
    ADD CONSTRAINT model_resource_defaults_pkey PRIMARY KEY (owner_scope, owner_id, modality);


--
-- Name: model_resources model_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_resources
    ADD CONSTRAINT model_resources_pkey PRIMARY KEY (id);


--
-- Name: model_resources model_resources_provider_connection_id_identifier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_resources
    ADD CONSTRAINT model_resources_provider_connection_id_identifier_key UNIQUE (provider_connection_id, identifier);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_source_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_source_entity_id_key UNIQUE (user_id, source, entity_id);


--
-- Name: organizations orchestration_organizations_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT orchestration_organizations_id_slug_key UNIQUE (id, slug);


--
-- Name: orchestration_resource_plans orchestration_resource_plans_org_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_org_id_unique UNIQUE (organization_id, id);


--
-- Name: orchestration_resource_plans orchestration_resource_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_pkey PRIMARY KEY (id);


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_org_revision_snapshot_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_org_revision_snapshot_unique UNIQUE (organization_id, resource_id, revision, worker_spec_snapshot_id);


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_org_revision_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_org_revision_unique UNIQUE (organization_id, resource_id, revision);


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_pkey PRIMARY KEY (id);


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_resource_revision_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_resource_revision_unique UNIQUE (resource_id, revision);


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_result_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_result_unique UNIQUE (organization_id, resource_id, revision, resource_version);


--
-- Name: orchestration_resources orchestration_resources_identity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_identity_unique UNIQUE (organization_id, api_version, kind, namespace, name);


--
-- Name: orchestration_resources orchestration_resources_org_head_identity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_org_head_identity_unique UNIQUE (organization_id, id, uid, api_version, kind, namespace, name);


--
-- Name: orchestration_resources orchestration_resources_org_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_org_id_unique UNIQUE (organization_id, id);


--
-- Name: orchestration_resources orchestration_resources_org_uid_identity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_org_uid_identity_unique UNIQUE (organization_id, uid, api_version, kind, namespace, name);


--
-- Name: orchestration_resources orchestration_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_pkey PRIMARY KEY (id);


--
-- Name: orchestration_resources orchestration_resources_uid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_uid_unique UNIQUE (uid);


--
-- Name: orchestration_worker_launches orchestration_worker_launches_org_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_org_id_unique UNIQUE (organization_id, id);


--
-- Name: orchestration_worker_launches orchestration_worker_launches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_pkey PRIMARY KEY (id);


--
-- Name: orchestration_worker_launches orchestration_worker_launches_plan_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_plan_unique UNIQUE (organization_id, plan_id);


--
-- Name: orchestration_worker_launches orchestration_worker_launches_resource_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_resource_unique UNIQUE (organization_id, resource_id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_format; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_slug_format CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((length((slug)::text) >= 2) AND (length((slug)::text) <= 100)))) NOT VALID;


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: organizations organizations_slug_not_reserved; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_slug_not_reserved CHECK (((slug)::text <> ALL ((ARRAY['about'::character varying, 'admin'::character varying, 'agents'::character varying, 'api'::character varying, 'app'::character varying, 'auth'::character varying, 'billing'::character varying, 'blog'::character varying, 'careers'::character varying, 'changelog'::character varying, 'dashboard'::character varying, 'demo'::character varying, 'docs'::character varying, 'enterprise'::character varying, 'false'::character varying, 'forgot-password'::character varying, 'invite'::character varying, 'login'::character varying, 'logout'::character varying, 'me'::character varying, 'mock-checkout'::character varying, 'new'::character varying, 'null'::character varying, 'offline'::character varying, 'onboarding'::character varying, 'organizations'::character varying, 'orgs'::character varying, 'personal'::character varying, 'popout'::character varying, 'privacy'::character varying, 'register'::character varying, 'reset-password'::character varying, 'runners'::character varying, 'settings'::character varying, 'support'::character varying, 'terms'::character varying, 'true'::character varying, 'undefined'::character varying, 'verify-email'::character varying, 'www'::character varying])::text[]))) NOT VALID;


--
-- Name: payment_orders payment_orders_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: payment_orders payment_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_order_no_key UNIQUE (order_no);


--
-- Name: payment_orders payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: pending_runner_commands pending_runner_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_runner_commands
    ADD CONSTRAINT pending_runner_commands_pkey PRIMARY KEY (id);


--
-- Name: permission_policies permission_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_policies
    ADD CONSTRAINT permission_policies_pkey PRIMARY KEY (id);


--
-- Name: plan_prices plan_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_pkey PRIMARY KEY (id);


--
-- Name: plan_prices plan_prices_plan_id_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_plan_id_currency_key UNIQUE (plan_id, currency);


--
-- Name: pod_bindings pod_bindings_initiator_pod_target_pod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_bindings
    ADD CONSTRAINT pod_bindings_initiator_pod_target_pod_key UNIQUE (initiator_pod, target_pod);


--
-- Name: pod_bindings pod_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_bindings
    ADD CONSTRAINT pod_bindings_pkey PRIMARY KEY (id);


--
-- Name: pod_config_revisions pod_config_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_config_revisions
    ADD CONSTRAINT pod_config_revisions_pkey PRIMARY KEY (id);


--
-- Name: pod_config_revisions pod_config_revisions_pod_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_config_revisions
    ADD CONSTRAINT pod_config_revisions_pod_revision_key UNIQUE (pod_id, revision);


--
-- Name: pod_session_usage pod_session_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_session_usage
    ADD CONSTRAINT pod_session_usage_pkey PRIMARY KEY (pod_key, model);


--
-- Name: pods pods_org_id_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_org_id_key_unique UNIQUE (organization_id, id, pod_key);


--
-- Name: pods pods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_pkey PRIMARY KEY (id);


--
-- Name: pods pods_pod_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_pod_key_key UNIQUE (pod_key);


--
-- Name: promo_code_redemptions promo_code_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: provider_connections provider_connections_owner_scope_owner_id_identifier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_owner_scope_owner_id_identifier_key UNIQUE (owner_scope, owner_id, identifier);


--
-- Name: provider_connections provider_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_pkey PRIMARY KEY (id);


--
-- Name: autopilot_iterations ralph_iterations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_iterations
    ADD CONSTRAINT ralph_iterations_pkey PRIMARY KEY (id);


--
-- Name: autopilot_controllers ralph_pods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_controllers
    ADD CONSTRAINT ralph_pods_pkey PRIMARY KEY (id);


--
-- Name: repositories repositories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repositories
    ADD CONSTRAINT repositories_pkey PRIMARY KEY (id);


--
-- Name: resource_grants resource_grants_organization_id_resource_type_resource_id_u_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_grants
    ADD CONSTRAINT resource_grants_organization_id_resource_type_resource_id_u_key UNIQUE (organization_id, resource_type, resource_id, user_id);


--
-- Name: resource_grants resource_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_grants
    ADD CONSTRAINT resource_grants_pkey PRIMARY KEY (id);


--
-- Name: runner_certificates runner_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_certificates
    ADD CONSTRAINT runner_certificates_pkey PRIMARY KEY (id);


--
-- Name: runner_certificates runner_certificates_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_certificates
    ADD CONSTRAINT runner_certificates_serial_number_key UNIQUE (serial_number);


--
-- Name: runner_logs runner_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_logs
    ADD CONSTRAINT runner_logs_pkey PRIMARY KEY (id);


--
-- Name: runner_logs runner_logs_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_logs
    ADD CONSTRAINT runner_logs_request_id_key UNIQUE (request_id);


--
-- Name: runner_pending_auths runner_pending_auths_auth_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_pending_auths
    ADD CONSTRAINT runner_pending_auths_auth_key_key UNIQUE (auth_key);


--
-- Name: runner_pending_auths runner_pending_auths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_pending_auths
    ADD CONSTRAINT runner_pending_auths_pkey PRIMARY KEY (id);


--
-- Name: runner_reactivation_tokens runner_reactivation_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_reactivation_tokens
    ADD CONSTRAINT runner_reactivation_tokens_pkey PRIMARY KEY (id);


--
-- Name: runner_reactivation_tokens runner_reactivation_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_reactivation_tokens
    ADD CONSTRAINT runner_reactivation_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: runner_grpc_registration_tokens runner_registration_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_grpc_registration_tokens
    ADD CONSTRAINT runner_registration_tokens_pkey PRIMARY KEY (id);


--
-- Name: runner_grpc_registration_tokens runner_registration_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_grpc_registration_tokens
    ADD CONSTRAINT runner_registration_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: runners runners_organization_id_node_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runners
    ADD CONSTRAINT runners_organization_id_node_id_key UNIQUE (organization_id, node_id);


--
-- Name: runners runners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runners
    ADD CONSTRAINT runners_pkey PRIMARY KEY (id);


--
-- Name: session_comments session_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_comments
    ADD CONSTRAINT session_comments_pkey PRIMARY KEY (id);


--
-- Name: session_files session_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_files
    ADD CONSTRAINT session_files_pkey PRIMARY KEY (id);


--
-- Name: session_permissions session_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_permissions
    ADD CONSTRAINT session_permissions_pkey PRIMARY KEY (session_id, user_id);


--
-- Name: session_read_states session_read_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_read_states
    ADD CONSTRAINT session_read_states_pkey PRIMARY KEY (user_id, session_id);


--
-- Name: sso_configs sso_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configs
    ADD CONSTRAINT sso_configs_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_attachments support_ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_messages support_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_admin_audit_logs system_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_admin_audit_logs
    ADD CONSTRAINT system_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: ticket_assignees ticket_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignees
    ADD CONSTRAINT ticket_assignees_pkey PRIMARY KEY (ticket_id, user_id);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: ticket_commits ticket_commits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_commits
    ADD CONSTRAINT ticket_commits_pkey PRIMARY KEY (id);


--
-- Name: ticket_external_links ticket_external_links_organization_id_platform_type_externa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_external_links
    ADD CONSTRAINT ticket_external_links_organization_id_platform_type_externa_key UNIQUE (organization_id, platform_type, external_id);


--
-- Name: ticket_external_links ticket_external_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_external_links
    ADD CONSTRAINT ticket_external_links_pkey PRIMARY KEY (id);


--
-- Name: ticket_labels ticket_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_labels
    ADD CONSTRAINT ticket_labels_pkey PRIMARY KEY (ticket_id, label_id);


--
-- Name: ticket_merge_requests ticket_merge_requests_mr_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_merge_requests
    ADD CONSTRAINT ticket_merge_requests_mr_url_key UNIQUE (mr_url);


--
-- Name: ticket_merge_requests ticket_merge_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_merge_requests
    ADD CONSTRAINT ticket_merge_requests_pkey PRIMARY KEY (id);


--
-- Name: ticket_relations ticket_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_pkey PRIMARY KEY (id);


--
-- Name: ticket_relations ticket_relations_source_ticket_id_target_ticket_id_relation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_source_ticket_id_target_ticket_id_relation_key UNIQUE (source_ticket_id, target_ticket_id, relation_type);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_slug_format; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_slug_format CHECK ((((slug)::text ~ '^[A-Z][A-Z0-9]*-[0-9]+$'::text) AND ((length((slug)::text) >= 3) AND (length((slug)::text) <= 50)))) NOT VALID;


--
-- Name: token_quotas token_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_quotas
    ADD CONSTRAINT token_quotas_pkey PRIMARY KEY (id);


--
-- Name: token_usages token_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usages
    ADD CONSTRAINT token_usages_pkey PRIMARY KEY (id);


--
-- Name: api_keys uq_api_keys_org_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT uq_api_keys_org_name UNIQUE (organization_id, name);


--
-- Name: goal_loops uq_goal_loops_organization_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_loops
    ADD CONSTRAINT uq_goal_loops_organization_slug UNIQUE (organization_id, slug);


--
-- Name: webhook_events uq_webhook_events_event_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT uq_webhook_events_event_provider UNIQUE (event_id, provider);


--
-- Name: usage_records usage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_pkey PRIMARY KEY (id);


--
-- Name: user_agent_configs user_agent_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_agent_configs
    ADD CONSTRAINT user_agent_configs_pkey PRIMARY KEY (id);


--
-- Name: user_git_credentials user_git_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_git_credentials
    ADD CONSTRAINT user_git_credentials_pkey PRIMARY KEY (id);


--
-- Name: user_git_credentials user_git_credentials_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_git_credentials
    ADD CONSTRAINT user_git_credentials_user_id_name_key UNIQUE (user_id, name);


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);


--
-- Name: user_identities user_identities_provider_provider_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_provider_provider_user_id_key UNIQUE (provider, provider_user_id);


--
-- Name: user_repository_providers user_repository_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_repository_providers
    ADD CONSTRAINT user_repository_providers_pkey PRIMARY KEY (id);


--
-- Name: user_repository_providers user_repository_providers_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_repository_providers
    ADD CONSTRAINT user_repository_providers_user_id_name_key UNIQUE (user_id, name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: virtual_api_keys virtual_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.virtual_api_keys
    ADD CONSTRAINT virtual_api_keys_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: worker_spec_dependency_artifacts worker_spec_dependency_artifacts_one_per_snapshot; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_dependency_artifacts
    ADD CONSTRAINT worker_spec_dependency_artifacts_one_per_snapshot UNIQUE (organization_id, worker_spec_snapshot_id);


--
-- Name: worker_spec_dependency_artifacts worker_spec_dependency_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_dependency_artifacts
    ADD CONSTRAINT worker_spec_dependency_artifacts_pkey PRIMARY KEY (id);


--
-- Name: worker_spec_snapshots worker_spec_snapshots_organization_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_snapshots
    ADD CONSTRAINT worker_spec_snapshots_organization_id_id_key UNIQUE (organization_id, id);


--
-- Name: worker_spec_snapshots worker_spec_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_snapshots
    ADD CONSTRAINT worker_spec_snapshots_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_slug_format; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.workflows
    ADD CONSTRAINT workflows_slug_format CHECK ((((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((length((slug)::text) >= 2) AND (length((slug)::text) <= 100)))) NOT VALID;


--
-- Name: workflows workflows_slug_not_reserved; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.workflows
    ADD CONSTRAINT workflows_slug_not_reserved CHECK (((slug)::text <> ALL ((ARRAY['about'::character varying, 'admin'::character varying, 'agents'::character varying, 'api'::character varying, 'app'::character varying, 'auth'::character varying, 'billing'::character varying, 'blog'::character varying, 'careers'::character varying, 'changelog'::character varying, 'dashboard'::character varying, 'demo'::character varying, 'docs'::character varying, 'enterprise'::character varying, 'false'::character varying, 'forgot-password'::character varying, 'invite'::character varying, 'login'::character varying, 'logout'::character varying, 'me'::character varying, 'mock-checkout'::character varying, 'new'::character varying, 'null'::character varying, 'offline'::character varying, 'onboarding'::character varying, 'organizations'::character varying, 'orgs'::character varying, 'personal'::character varying, 'popout'::character varying, 'privacy'::character varying, 'register'::character varying, 'reset-password'::character varying, 'runners'::character varying, 'settings'::character varying, 'support'::character varying, 'terms'::character varying, 'true'::character varying, 'undefined'::character varying, 'verify-email'::character varying, 'www'::character varying])::text[]))) NOT VALID;


--
-- Name: idx_marketplace_domains_primary; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX idx_marketplace_domains_primary ON marketplace.marketplace_domains USING btree (marketplace_id) WHERE is_primary;


--
-- Name: idx_marketplace_entitlements_active_direct; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX idx_marketplace_entitlements_active_direct ON marketplace.marketplace_entitlements USING btree (marketplace_id, listing_id, subject_type, subject_platform_id, target_platform_org_id) WHERE (((source)::text = 'direct'::text) AND ((status)::text = 'active'::text));


--
-- Name: idx_marketplace_installations_single_active; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX idx_marketplace_installations_single_active ON marketplace.marketplace_installations USING btree (marketplace_id, listing_id, target_platform_org_id) WHERE ((status)::text = ANY ((ARRAY['installing'::character varying, 'verifying'::character varying, 'active'::character varying, 'suspended'::character varying])::text[]));


--
-- Name: idx_marketplace_listing_spaces_primary; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX idx_marketplace_listing_spaces_primary ON marketplace.marketplace_listing_spaces USING btree (listing_id) WHERE is_primary;


--
-- Name: idx_marketplace_listing_version_tags_filter; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX idx_marketplace_listing_version_tags_filter ON marketplace.marketplace_listing_version_tags USING btree (marketplace_id, taxonomy_tag_id, listing_version_id);


--
-- Name: idx_marketplace_listings_featured; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX idx_marketplace_listings_featured ON marketplace.marketplace_listings USING btree (marketplace_id, featured_rank DESC, published_at DESC, id DESC) WHERE (((status)::text = 'published'::text) AND ((visibility)::text = 'public'::text));


--
-- Name: idx_marketplace_listings_public; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX idx_marketplace_listings_public ON marketplace.marketplace_listings USING btree (marketplace_id, published_at DESC, id DESC) WHERE (((status)::text = 'published'::text) AND ((visibility)::text = 'public'::text));


--
-- Name: idx_marketplace_quota_grants_period; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX idx_marketplace_quota_grants_period ON marketplace.marketplace_quota_ledger_entries USING btree (quota_account_id, period_start) WHERE ((entry_type)::text = 'grant'::text);


--
-- Name: idx_marketplace_taxonomy_tags_filter; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX idx_marketplace_taxonomy_tags_filter ON marketplace.marketplace_taxonomy_tags USING btree (marketplace_id, kind, slug);


--
-- Name: coordinator_executions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_executions_org ON public.coordinator_executions USING btree (organization_id);


--
-- Name: coordinator_executions_pod_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_executions_pod_key ON public.coordinator_executions USING btree (pod_key);


--
-- Name: coordinator_executions_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_executions_project ON public.coordinator_executions USING btree (project_id);


--
-- Name: coordinator_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_executions_status ON public.coordinator_executions USING btree (status);


--
-- Name: coordinator_executions_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_executions_ticket ON public.coordinator_executions USING btree (ticket_id);


--
-- Name: coordinator_projects_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_projects_enabled ON public.coordinator_projects USING btree (enabled);


--
-- Name: coordinator_projects_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_projects_org ON public.coordinator_projects USING btree (organization_id);


--
-- Name: coordinator_projects_repository; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinator_projects_repository ON public.coordinator_projects USING btree (repository_id);


--
-- Name: env_bundles_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX env_bundles_kind ON public.env_bundles USING btree (kind);


--
-- Name: env_bundles_owner_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX env_bundles_owner_agent ON public.env_bundles USING btree (owner_scope, owner_id, agent_slug);


--
-- Name: env_bundles_owner_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX env_bundles_owner_kind ON public.env_bundles USING btree (owner_scope, owner_id, kind);


--
-- Name: env_bundles_primary_per_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX env_bundles_primary_per_kind ON public.env_bundles USING btree (owner_scope, owner_id, agent_slug, kind) WHERE (kind_primary = true);


--
-- Name: idx_admin_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_action ON public.system_admin_audit_logs USING btree (action);


--
-- Name: idx_admin_audit_admin_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_admin_user ON public.system_admin_audit_logs USING btree (admin_user_id);


--
-- Name: idx_admin_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_created ON public.system_admin_audit_logs USING btree (created_at);


--
-- Name: idx_admin_audit_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_target ON public.system_admin_audit_logs USING btree (target_type, target_id);


--
-- Name: idx_agent_sessions_active_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_sessions_active_user ON public.agent_sessions USING btree (organization_id, user_id, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_agent_sessions_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_sessions_org_user ON public.agent_sessions USING btree (organization_id, user_id);


--
-- Name: idx_agent_sessions_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_sessions_parent ON public.agent_sessions USING btree (parent_session_id);


--
-- Name: idx_agent_sessions_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_sessions_project ON public.agent_sessions USING btree (organization_id, user_id, project) WHERE ((project IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_agent_types_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_types_slug_active ON public.agents USING btree (slug) WHERE (is_active = true);


--
-- Name: idx_ai_models_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_org ON public.ai_models USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_ai_models_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_models_user ON public.ai_models USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_ai_resource_migration_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_resource_migration_connection ON public.ai_resource_migration_map USING btree (provider_connection_id);


--
-- Name: idx_ai_resource_migration_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_resource_migration_resource ON public.ai_resource_migration_map USING btree (model_resource_id);


--
-- Name: idx_api_keys_enabled_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_enabled_expires ON public.api_keys USING btree (is_enabled, expires_at);


--
-- Name: idx_api_keys_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_org_id ON public.api_keys USING btree (organization_id);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_org_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_org_time ON public.audit_logs USING btree (organization_id, created_at);


--
-- Name: idx_audit_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_autopilot_controllers_autopilot_controller_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_autopilot_controllers_autopilot_controller_key ON public.autopilot_controllers USING btree (autopilot_controller_key);


--
-- Name: idx_autopilot_controllers_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autopilot_controllers_organization_id ON public.autopilot_controllers USING btree (organization_id);


--
-- Name: idx_autopilot_controllers_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autopilot_controllers_phase ON public.autopilot_controllers USING btree (phase);


--
-- Name: idx_autopilot_controllers_pod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autopilot_controllers_pod_id ON public.autopilot_controllers USING btree (pod_id);


--
-- Name: idx_autopilot_controllers_pod_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autopilot_controllers_pod_key ON public.autopilot_controllers USING btree (pod_key);


--
-- Name: idx_autopilot_controllers_runner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autopilot_controllers_runner_id ON public.autopilot_controllers USING btree (runner_id);


--
-- Name: idx_autopilot_iterations_autopilot_controller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autopilot_iterations_autopilot_controller_id ON public.autopilot_iterations USING btree (autopilot_controller_id);


--
-- Name: idx_autopilot_iterations_iteration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_autopilot_iterations_iteration ON public.autopilot_iterations USING btree (autopilot_controller_id, iteration);


--
-- Name: idx_block_embeddings_hnsw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_embeddings_hnsw ON public.block_embeddings USING hnsw (vec public.vector_cosine_ops);


--
-- Name: idx_block_embeddings_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_embeddings_model ON public.block_embeddings USING btree (model);


--
-- Name: idx_block_ops_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_ops_actor ON public.block_ops USING btree (actor_type, actor_id);


--
-- Name: idx_block_ops_stream; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_ops_stream ON public.block_ops USING btree (workspace_id, id);


--
-- Name: idx_block_refs_backlinks; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_refs_backlinks ON public.block_refs USING btree (to_id, rel);


--
-- Name: idx_block_refs_children; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_refs_children ON public.block_refs USING btree (from_id, rel, order_key);


--
-- Name: idx_block_refs_single_nest_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_block_refs_single_nest_parent ON public.block_refs USING btree (to_id) WHERE ((rel)::text = 'nest'::text);


--
-- Name: idx_block_refs_unique_edge; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_block_refs_unique_edge ON public.block_refs USING btree (from_id, to_id, rel, COALESCE(anchor, ''::text));


--
-- Name: idx_block_workspaces_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_workspaces_org ON public.block_workspaces USING btree (organization_id);


--
-- Name: idx_blocks_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_data ON public.blocks USING gin (data);


--
-- Name: idx_blocks_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_tsv ON public.blocks USING gin (tsv);


--
-- Name: idx_blocks_workspace_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_workspace_type ON public.blocks USING btree (workspace_id, type) WHERE (deleted_at IS NULL);


--
-- Name: idx_blocks_workspace_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_workspace_updated ON public.blocks USING btree (workspace_id, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_channel_access_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_access_channel ON public.channel_access USING btree (channel_id);


--
-- Name: idx_channel_access_pod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_access_pod ON public.channel_access USING btree (pod_key);


--
-- Name: idx_channel_members_user_channels; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_user_channels ON public.channel_members USING btree (user_id, channel_id);


--
-- Name: idx_channel_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_members_user_id ON public.channel_members USING btree (user_id);


--
-- Name: idx_channel_messages_body_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_messages_body_fts ON public.channel_messages USING gin (to_tsvector('english'::regconfig, body));


--
-- Name: idx_channel_messages_cursor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_messages_cursor ON public.channel_messages USING btree (channel_id, id DESC);


--
-- Name: idx_channel_messages_mentions_pod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_messages_mentions_pod ON public.channel_messages USING gin (mentions jsonb_path_ops);


--
-- Name: idx_channel_messages_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_messages_not_deleted ON public.channel_messages USING btree (channel_id, id) WHERE (is_deleted = false);


--
-- Name: idx_channel_messages_sender_pod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_messages_sender_pod ON public.channel_messages USING btree (sender_pod) WHERE (sender_pod IS NOT NULL);


--
-- Name: idx_channel_messages_sender_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_messages_sender_user ON public.channel_messages USING btree (sender_user_id) WHERE (sender_user_id IS NOT NULL);


--
-- Name: idx_channel_pods_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_pods_channel ON public.channel_pods USING btree (channel_id);


--
-- Name: idx_channel_pods_pod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_pods_pod ON public.channel_pods USING btree (pod_key);


--
-- Name: idx_channels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_org ON public.channels USING btree (organization_id);


--
-- Name: idx_channels_org_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_org_visibility ON public.channels USING btree (organization_id, visibility);


--
-- Name: idx_conversation_items_session_pos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_items_session_pos ON public.conversation_items USING btree (session_id, "position" DESC);


--
-- Name: idx_coordinator_projects_worker_spec_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coordinator_projects_worker_spec_snapshot_id ON public.coordinator_projects USING btree (worker_spec_snapshot_id) WHERE (worker_spec_snapshot_id IS NOT NULL);


--
-- Name: idx_custom_agents_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_agents_org ON public.custom_agents USING btree (organization_id);


--
-- Name: idx_expert_market_applications_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expert_market_applications_publisher ON public.expert_market_applications USING btree (publisher_organization_id, created_at DESC);


--
-- Name: idx_expert_market_releases_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expert_market_releases_application ON public.expert_market_releases USING btree (application_id, version DESC);


--
-- Name: idx_expert_market_releases_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expert_market_releases_publisher ON public.expert_market_releases USING btree (publisher_organization_id, created_at DESC);


--
-- Name: idx_expert_market_releases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expert_market_releases_status ON public.expert_market_releases USING btree (status, created_at DESC);


--
-- Name: idx_experts_orchestration_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_experts_orchestration_resource ON public.experts USING btree (organization_id, orchestration_resource_id) WHERE (orchestration_resource_id IS NOT NULL);


--
-- Name: idx_experts_org_market_application; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_experts_org_market_application ON public.experts USING btree (organization_id, source_market_application_id) WHERE (source_market_application_id IS NOT NULL);


--
-- Name: idx_experts_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_experts_org_slug ON public.experts USING btree (organization_id, slug);


--
-- Name: idx_experts_org_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_experts_org_updated ON public.experts USING btree (organization_id, updated_at DESC);


--
-- Name: idx_experts_worker_spec_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_experts_worker_spec_snapshot_id ON public.experts USING btree (worker_spec_snapshot_id) WHERE (worker_spec_snapshot_id IS NOT NULL);


--
-- Name: idx_files_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_organization_id ON public.files USING btree (organization_id);


--
-- Name: idx_files_storage_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_files_storage_key ON public.files USING btree (storage_key);


--
-- Name: idx_files_uploader_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_uploader_id ON public.files USING btree (uploader_id);


--
-- Name: idx_git_providers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_git_providers_org ON public.git_providers USING btree (organization_id);


--
-- Name: idx_goal_loops_orchestration_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_goal_loops_orchestration_resource ON public.goal_loops USING btree (organization_id, orchestration_resource_id) WHERE (orchestration_resource_id IS NOT NULL);


--
-- Name: idx_goal_loops_organization_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goal_loops_organization_created_at ON public.goal_loops USING btree (organization_id, created_at DESC);


--
-- Name: idx_goal_loops_pod_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goal_loops_pod_key ON public.goal_loops USING btree (pod_key) WHERE (pod_key IS NOT NULL);


--
-- Name: idx_goal_loops_retry_prompt_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goal_loops_retry_prompt_pending ON public.goal_loops USING btree (id) WHERE (((status)::text = 'verifying'::text) AND (retry_prompt_command_id IS NOT NULL));


--
-- Name: idx_goal_loops_verification_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_goal_loops_verification_request_id ON public.goal_loops USING btree (verification_request_id) WHERE (verification_request_id IS NOT NULL);


--
-- Name: idx_grpc_reg_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grpc_reg_tokens_expires ON public.runner_grpc_registration_tokens USING btree (expires_at);


--
-- Name: idx_grpc_reg_tokens_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grpc_reg_tokens_org ON public.runner_grpc_registration_tokens USING btree (organization_id);


--
-- Name: idx_identifier_backfill_audit_table_row; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identifier_backfill_audit_table_row ON public.identifier_backfill_audit USING btree (table_name, row_id);


--
-- Name: idx_installed_mcp_servers_repo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installed_mcp_servers_repo ON public.installed_mcp_servers USING btree (organization_id, repository_id);


--
-- Name: idx_installed_mcp_servers_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_installed_mcp_servers_unique ON public.installed_mcp_servers USING btree (organization_id, repository_id, scope, installed_by, slug) WHERE (installed_by IS NOT NULL);


--
-- Name: idx_installed_mcp_servers_unique_no_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_installed_mcp_servers_unique_no_user ON public.installed_mcp_servers USING btree (organization_id, repository_id, scope, slug) WHERE (installed_by IS NULL);


--
-- Name: idx_installed_skills_repo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installed_skills_repo ON public.installed_skills USING btree (organization_id, repository_id);


--
-- Name: idx_installed_skills_skill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installed_skills_skill ON public.installed_skills USING btree (skill_id);


--
-- Name: idx_installed_skills_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_installed_skills_unique ON public.installed_skills USING btree (organization_id, repository_id, scope, installed_by, slug) WHERE (installed_by IS NOT NULL);


--
-- Name: idx_installed_skills_unique_no_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_installed_skills_unique_no_user ON public.installed_skills USING btree (organization_id, repository_id, scope, slug) WHERE (installed_by IS NULL);


--
-- Name: idx_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_email ON public.invitations USING btree (email);


--
-- Name: idx_invitations_org_email_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_invitations_org_email_pending ON public.invitations USING btree (organization_id, email) WHERE (accepted_at IS NULL);


--
-- Name: idx_invitations_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_organization_id ON public.invitations USING btree (organization_id);


--
-- Name: idx_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);


--
-- Name: idx_invoices_invoice_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_invoice_no ON public.invoices USING btree (invoice_no);


--
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_labels_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labels_org ON public.labels USING btree (organization_id);


--
-- Name: idx_labels_repo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labels_repo ON public.labels USING btree (repository_id);


--
-- Name: idx_licenses_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_key ON public.licenses USING btree (license_key);


--
-- Name: idx_licenses_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_org ON public.licenses USING btree (activated_org_id);


--
-- Name: idx_mcp_market_items_registry_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mcp_market_items_registry_name ON public.mcp_market_items USING btree (registry_name) WHERE (registry_name IS NOT NULL);


--
-- Name: idx_message_edits_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_edits_message ON public.channel_message_edits USING btree (message_id);


--
-- Name: idx_model_resource_defaults_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_resource_defaults_resource ON public.model_resource_defaults USING btree (model_resource_id);


--
-- Name: idx_model_resources_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_resources_connection ON public.model_resources USING btree (provider_connection_id);


--
-- Name: idx_model_resources_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_resources_enabled ON public.model_resources USING btree (is_enabled) WHERE is_enabled;


--
-- Name: idx_model_resources_modalities; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_resources_modalities ON public.model_resources USING gin (modalities);


--
-- Name: idx_notification_preferences_user_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_user_source ON public.notification_preferences USING btree (user_id, source);


--
-- Name: idx_orchestration_resource_plans_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orchestration_resource_plans_expiry ON public.orchestration_resource_plans USING btree (organization_id, expires_at) WHERE (consumed_at IS NULL);


--
-- Name: idx_orchestration_resource_revisions_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orchestration_resource_revisions_history ON public.orchestration_resource_revisions USING btree (organization_id, resource_id, revision DESC);


--
-- Name: idx_orchestration_resources_tenant_head; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orchestration_resources_tenant_head ON public.orchestration_resources USING btree (organization_id, updated_at DESC, id DESC);


--
-- Name: idx_orchestration_resources_tenant_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orchestration_resources_tenant_list ON public.orchestration_resources USING btree (organization_id, kind, namespace, name);


--
-- Name: idx_orchestration_worker_launches_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orchestration_worker_launches_pending ON public.orchestration_worker_launches USING btree (organization_id, state, lease_expires_at, id) WHERE ((state)::text <> 'dispatched'::text);


--
-- Name: idx_org_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_org ON public.organization_members USING btree (organization_id);


--
-- Name: idx_org_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user ON public.organization_members USING btree (user_id);


--
-- Name: idx_organizations_amp_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_organizations_amp_tenant_id ON public.organizations USING btree (amp_tenant_id) WHERE ((amp_tenant_id IS NOT NULL) AND (btrim((amp_tenant_id)::text) <> ''::text));


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_payment_orders_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_created ON public.payment_orders USING btree (created_at);


--
-- Name: idx_payment_orders_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_external ON public.payment_orders USING btree (external_order_no);


--
-- Name: idx_payment_orders_order_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_order_no ON public.payment_orders USING btree (order_no);


--
-- Name: idx_payment_orders_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_org ON public.payment_orders USING btree (organization_id);


--
-- Name: idx_payment_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_status ON public.payment_orders USING btree (status);


--
-- Name: idx_payment_transactions_external; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_external ON public.payment_transactions USING btree (external_transaction_id);


--
-- Name: idx_payment_transactions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_order ON public.payment_transactions USING btree (payment_order_id);


--
-- Name: idx_payment_transactions_webhook; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_webhook ON public.payment_transactions USING btree (webhook_event_id);


--
-- Name: idx_pending_cmds_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_cmds_expiry ON public.pending_runner_commands USING btree (expires_at);


--
-- Name: idx_pending_cmds_runner_fifo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_cmds_runner_fifo ON public.pending_runner_commands USING btree (runner_id, id);


--
-- Name: idx_permission_policies_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_policies_org ON public.permission_policies USING btree (organization_id, priority DESC);


--
-- Name: idx_permission_policies_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permission_policies_session ON public.permission_policies USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_plan_prices_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_prices_currency ON public.plan_prices USING btree (currency);


--
-- Name: idx_plan_prices_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_prices_plan ON public.plan_prices USING btree (plan_id);


--
-- Name: idx_pod_bindings_initiator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pod_bindings_initiator ON public.pod_bindings USING btree (initiator_pod);


--
-- Name: idx_pod_bindings_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pod_bindings_org ON public.pod_bindings USING btree (organization_id);


--
-- Name: idx_pod_bindings_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pod_bindings_target ON public.pod_bindings USING btree (target_pod);


--
-- Name: idx_pod_config_revisions_model_resource_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pod_config_revisions_model_resource_id ON public.pod_config_revisions USING btree (model_resource_id);


--
-- Name: idx_pod_config_revisions_one_active_per_pod; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pod_config_revisions_one_active_per_pod ON public.pod_config_revisions USING btree (pod_id) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_pod_config_revisions_pod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pod_config_revisions_pod_id ON public.pod_config_revisions USING btree (pod_id);


--
-- Name: idx_pod_config_revisions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pod_config_revisions_status ON public.pod_config_revisions USING btree (status);


--
-- Name: idx_pods_active_config_revision_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_active_config_revision_id ON public.pods USING btree (active_config_revision_id);


--
-- Name: idx_pods_agent_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_agent_slug ON public.pods USING btree (agent_slug);


--
-- Name: idx_pods_agent_waiting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_agent_waiting ON public.pods USING btree (agent_waiting_since) WHERE (((status)::text = 'running'::text) AND ((agent_status)::text = 'waiting'::text) AND (agent_waiting_since IS NOT NULL));


--
-- Name: idx_pods_cluster_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_cluster_id ON public.pods USING btree (cluster_id);


--
-- Name: idx_pods_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_key ON public.pods USING btree (pod_key);


--
-- Name: idx_pods_model_resource_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_model_resource_id ON public.pods USING btree (model_resource_id);


--
-- Name: idx_pods_orchestration_worker_launch; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pods_orchestration_worker_launch ON public.pods USING btree (organization_id, orchestration_worker_launch_id) WHERE (orchestration_worker_launch_id IS NOT NULL);


--
-- Name: idx_pods_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_org ON public.pods USING btree (organization_id);


--
-- Name: idx_pods_org_repo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_org_repo ON public.pods USING btree (organization_id, repository_id) WHERE (repository_id IS NOT NULL);


--
-- Name: idx_pods_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_org_status ON public.pods USING btree (organization_id, status);


--
-- Name: idx_pods_pending_config_revision_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_pending_config_revision_id ON public.pods USING btree (pending_config_revision_id);


--
-- Name: idx_pods_runner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_runner ON public.pods USING btree (runner_id);


--
-- Name: idx_pods_runner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_runner_status ON public.pods USING btree (runner_id, status);


--
-- Name: idx_pods_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_session_id ON public.pods USING btree (session_id);


--
-- Name: idx_pods_source_pod_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_source_pod_key ON public.pods USING btree (source_pod_key);


--
-- Name: idx_pods_source_pod_key_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pods_source_pod_key_active_unique ON public.pods USING btree (source_pod_key) WHERE ((source_pod_key IS NOT NULL) AND ((status)::text = ANY ((ARRAY['initializing'::character varying, 'running'::character varying, 'paused'::character varying, 'disconnected'::character varying])::text[])));


--
-- Name: idx_pods_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_status ON public.pods USING btree (status);


--
-- Name: idx_pods_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_ticket_id ON public.pods USING btree (ticket_id);


--
-- Name: idx_pods_virtual_api_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_virtual_api_key ON public.pods USING btree (virtual_api_key_id) WHERE (virtual_api_key_id IS NOT NULL);


--
-- Name: idx_pods_worker_spec_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pods_worker_spec_snapshot_id ON public.pods USING btree (worker_spec_snapshot_id) WHERE (worker_spec_snapshot_id IS NOT NULL);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code);


--
-- Name: idx_promo_codes_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_is_active ON public.promo_codes USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_promo_codes_plan_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_plan_name ON public.promo_codes USING btree (plan_name);


--
-- Name: idx_promo_codes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_type ON public.promo_codes USING btree (type);


--
-- Name: idx_promo_redemptions_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_redemptions_code_id ON public.promo_code_redemptions USING btree (promo_code_id);


--
-- Name: idx_promo_redemptions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_redemptions_created_at ON public.promo_code_redemptions USING btree (created_at);


--
-- Name: idx_promo_redemptions_org_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_promo_redemptions_org_code_unique ON public.promo_code_redemptions USING btree (organization_id, promo_code_id);


--
-- Name: idx_promo_redemptions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_redemptions_org_id ON public.promo_code_redemptions USING btree (organization_id);


--
-- Name: idx_promo_redemptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_redemptions_user_id ON public.promo_code_redemptions USING btree (user_id);


--
-- Name: idx_provider_connections_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_connections_enabled ON public.provider_connections USING btree (is_enabled) WHERE is_enabled;


--
-- Name: idx_provider_connections_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_connections_owner ON public.provider_connections USING btree (owner_scope, owner_id);


--
-- Name: idx_provider_connections_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_connections_provider ON public.provider_connections USING btree (provider_key);


--
-- Name: idx_reg_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reg_tokens_hash ON public.runner_grpc_registration_tokens USING btree (token_hash);


--
-- Name: idx_reg_tokens_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reg_tokens_org ON public.runner_grpc_registration_tokens USING btree (organization_id);


--
-- Name: idx_repositories_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repositories_deleted_at ON public.repositories USING btree (deleted_at);


--
-- Name: idx_repositories_imported_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repositories_imported_by ON public.repositories USING btree (imported_by_user_id);


--
-- Name: idx_repositories_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repositories_org ON public.repositories USING btree (organization_id);


--
-- Name: idx_repositories_org_provider_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_repositories_org_provider_slug ON public.repositories USING btree (organization_id, provider_type, provider_base_url, slug) WHERE (deleted_at IS NULL);


--
-- Name: idx_repositories_provider_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repositories_provider_type ON public.repositories USING btree (provider_type);


--
-- Name: idx_repositories_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repositories_visibility ON public.repositories USING btree (visibility);


--
-- Name: idx_resource_grants_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_grants_lookup ON public.resource_grants USING btree (organization_id, resource_type, resource_id);


--
-- Name: idx_resource_grants_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_grants_resource ON public.resource_grants USING btree (resource_type, resource_id);


--
-- Name: idx_resource_grants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_grants_user ON public.resource_grants USING btree (organization_id, user_id);


--
-- Name: idx_runner_certs_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_certs_expires ON public.runner_certificates USING btree (expires_at);


--
-- Name: idx_runner_certs_revoked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_certs_revoked ON public.runner_certificates USING btree (revoked_at) WHERE (revoked_at IS NOT NULL);


--
-- Name: idx_runner_certs_runner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_certs_runner_id ON public.runner_certificates USING btree (runner_id);


--
-- Name: idx_runner_certs_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_certs_serial ON public.runner_certificates USING btree (serial_number);


--
-- Name: idx_runner_grpc_registration_tokens_cluster_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_grpc_registration_tokens_cluster_id ON public.runner_grpc_registration_tokens USING btree (cluster_id);


--
-- Name: idx_runner_logs_org_runner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_logs_org_runner ON public.runner_logs USING btree (organization_id, runner_id, created_at DESC);


--
-- Name: idx_runner_pending_auths_cluster_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_pending_auths_cluster_id ON public.runner_pending_auths USING btree (cluster_id);


--
-- Name: idx_runner_pending_auths_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_pending_auths_expires ON public.runner_pending_auths USING btree (expires_at);


--
-- Name: idx_runner_pending_auths_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_pending_auths_key ON public.runner_pending_auths USING btree (auth_key);


--
-- Name: idx_runner_reactivation_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_reactivation_expires ON public.runner_reactivation_tokens USING btree (expires_at);


--
-- Name: idx_runner_reactivation_runner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runner_reactivation_runner ON public.runner_reactivation_tokens USING btree (runner_id);


--
-- Name: idx_runners_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_available ON public.runners USING btree (organization_id, status, current_pods);


--
-- Name: idx_runners_cluster_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_cluster_id ON public.runners USING btree (cluster_id);


--
-- Name: idx_runners_node_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_node_id ON public.runners USING btree (node_id);


--
-- Name: idx_runners_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_org ON public.runners USING btree (organization_id);


--
-- Name: idx_runners_registered_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_registered_by_user_id ON public.runners USING btree (registered_by_user_id);


--
-- Name: idx_runners_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_status ON public.runners USING btree (status);


--
-- Name: idx_runners_status_heartbeat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_status_heartbeat ON public.runners USING btree (status, last_heartbeat);


--
-- Name: idx_runners_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_tags ON public.runners USING gin (tags);


--
-- Name: idx_runners_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runners_visibility ON public.runners USING btree (visibility);


--
-- Name: idx_session_comments_session_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_comments_session_path ON public.session_comments USING btree (session_id, path);


--
-- Name: idx_session_files_minio_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_session_files_minio_key ON public.session_files USING btree (minio_key);


--
-- Name: idx_session_files_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_files_session ON public.session_files USING btree (session_id, created_at DESC);


--
-- Name: idx_session_permissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_permissions_user ON public.session_permissions USING btree (user_id);


--
-- Name: idx_session_read_states_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_read_states_user ON public.session_read_states USING btree (user_id);


--
-- Name: idx_skills_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_skills_org_slug ON public.skills USING btree (COALESCE(organization_id, (0)::bigint), slug);


--
-- Name: idx_skills_org_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skills_org_updated ON public.skills USING btree (organization_id, updated_at DESC);


--
-- Name: idx_skills_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skills_tags ON public.skills USING gin (tags);


--
-- Name: idx_sso_configs_amp_bearer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sso_configs_amp_bearer ON public.sso_configs USING btree (protocol, is_enabled) WHERE (jsonb_array_length(amp_bearer_app_codes) > 0);


--
-- Name: idx_sso_configs_default_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sso_configs_default_org ON public.sso_configs USING btree (default_organization_id) WHERE (default_organization_id IS NOT NULL);


--
-- Name: idx_sso_configs_domain_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sso_configs_domain_enabled ON public.sso_configs USING btree (domain, is_enabled);


--
-- Name: idx_sso_configs_domain_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_sso_configs_domain_protocol ON public.sso_configs USING btree (domain, protocol);


--
-- Name: idx_subscriptions_lemonsqueezy_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_lemonsqueezy_customer ON public.subscriptions USING btree (lemonsqueezy_customer_id) WHERE (lemonsqueezy_customer_id IS NOT NULL);


--
-- Name: idx_subscriptions_lemonsqueezy_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_lemonsqueezy_subscription ON public.subscriptions USING btree (lemonsqueezy_subscription_id) WHERE (lemonsqueezy_subscription_id IS NOT NULL);


--
-- Name: idx_subscriptions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_org ON public.subscriptions USING btree (organization_id);


--
-- Name: idx_subscriptions_period_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_period_end ON public.subscriptions USING btree (current_period_end) WHERE ((status)::text = ANY ((ARRAY['active'::character varying, 'trialing'::character varying])::text[]));


--
-- Name: idx_support_ticket_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_attachments_message_id ON public.support_ticket_attachments USING btree (message_id);


--
-- Name: idx_support_ticket_attachments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_attachments_ticket_id ON public.support_ticket_attachments USING btree (ticket_id);


--
-- Name: idx_support_ticket_messages_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_ticket_messages_ticket_id ON public.support_ticket_messages USING btree (ticket_id);


--
-- Name: idx_support_tickets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_category ON public.support_tickets USING btree (category);


--
-- Name: idx_support_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_support_tickets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets USING btree (user_id);


--
-- Name: idx_ticket_assignees_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_assignees_ticket ON public.ticket_assignees USING btree (ticket_id);


--
-- Name: idx_ticket_assignees_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_assignees_user ON public.ticket_assignees USING btree (user_id);


--
-- Name: idx_ticket_comments_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_created ON public.ticket_comments USING btree (created_at);


--
-- Name: idx_ticket_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_parent ON public.ticket_comments USING btree (parent_id);


--
-- Name: idx_ticket_comments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments USING btree (ticket_id);


--
-- Name: idx_ticket_comments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_user ON public.ticket_comments USING btree (user_id);


--
-- Name: idx_ticket_commits_repo_sha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_commits_repo_sha ON public.ticket_commits USING btree (repository_id, commit_sha);


--
-- Name: idx_ticket_commits_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_commits_ticket ON public.ticket_commits USING btree (ticket_id);


--
-- Name: idx_ticket_merge_requests_pod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_merge_requests_pod_id ON public.ticket_merge_requests USING btree (pod_id);


--
-- Name: idx_ticket_merge_requests_repo_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_merge_requests_repo_branch ON public.ticket_merge_requests USING btree (repository_id, source_branch);


--
-- Name: idx_ticket_merge_requests_repository_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_merge_requests_repository_id ON public.ticket_merge_requests USING btree (repository_id);


--
-- Name: idx_ticket_mrs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_mrs_org ON public.ticket_merge_requests USING btree (organization_id);


--
-- Name: idx_ticket_mrs_pipeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_mrs_pipeline ON public.ticket_merge_requests USING btree (pipeline_status);


--
-- Name: idx_ticket_mrs_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_mrs_ticket ON public.ticket_merge_requests USING btree (ticket_id);


--
-- Name: idx_ticket_relations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_relations_source ON public.ticket_relations USING btree (source_ticket_id);


--
-- Name: idx_ticket_relations_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_relations_target ON public.ticket_relations USING btree (target_ticket_id);


--
-- Name: idx_tickets_content_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_content_block ON public.tickets USING btree (content_block_id) WHERE (content_block_id IS NOT NULL);


--
-- Name: idx_tickets_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_org ON public.tickets USING btree (organization_id);


--
-- Name: idx_tickets_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tickets_org_slug ON public.tickets USING btree (organization_id, slug);


--
-- Name: idx_tickets_repo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_repo ON public.tickets USING btree (repository_id);


--
-- Name: idx_tickets_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_severity ON public.tickets USING btree (severity);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


--
-- Name: idx_token_usages_org_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_usages_org_agent ON public.token_usages USING btree (organization_id, agent_slug, created_at);


--
-- Name: idx_token_usages_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_usages_org_created ON public.token_usages USING btree (organization_id, created_at);


--
-- Name: idx_token_usages_org_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_usages_org_model ON public.token_usages USING btree (organization_id, model, created_at);


--
-- Name: idx_token_usages_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_usages_org_user ON public.token_usages USING btree (organization_id, user_id, created_at);


--
-- Name: idx_token_usages_pod_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_usages_pod_key ON public.token_usages USING btree (pod_key);


--
-- Name: idx_usage_org_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_org_period ON public.usage_records USING btree (organization_id, period_start, period_end);


--
-- Name: idx_usage_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_type ON public.usage_records USING btree (usage_type);


--
-- Name: idx_user_agent_configs_agent_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_agent_configs_agent_slug ON public.user_agent_configs USING btree (agent_slug);


--
-- Name: idx_user_agent_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_agent_configs_user_id ON public.user_agent_configs USING btree (user_id);


--
-- Name: idx_user_git_credentials_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_git_credentials_default ON public.user_git_credentials USING btree (user_id, is_default) WHERE (is_default = true);


--
-- Name: idx_user_git_credentials_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_git_credentials_type ON public.user_git_credentials USING btree (credential_type);


--
-- Name: idx_user_git_credentials_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_git_credentials_user ON public.user_git_credentials USING btree (user_id);


--
-- Name: idx_user_identities_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_identities_provider ON public.user_identities USING btree (provider, provider_user_id);


--
-- Name: idx_user_identities_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_identities_user ON public.user_identities USING btree (user_id);


--
-- Name: idx_user_repository_providers_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_repository_providers_identity ON public.user_repository_providers USING btree (identity_id);


--
-- Name: idx_user_repository_providers_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_repository_providers_type ON public.user_repository_providers USING btree (provider_type);


--
-- Name: idx_user_repository_providers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_repository_providers_user ON public.user_repository_providers USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_verification_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_verification_token ON public.users USING btree (email_verification_token) WHERE (email_verification_token IS NOT NULL);


--
-- Name: idx_users_is_system_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_system_admin ON public.users USING btree (is_system_admin) WHERE (is_system_admin = true);


--
-- Name: idx_users_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_password_reset_token ON public.users USING btree (password_reset_token) WHERE (password_reset_token IS NOT NULL);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_virtual_api_keys_model_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_virtual_api_keys_model_resource ON public.virtual_api_keys USING btree (model_resource_id);


--
-- Name: idx_virtual_api_keys_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_virtual_api_keys_org ON public.virtual_api_keys USING btree (organization_id);


--
-- Name: idx_virtual_api_keys_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_virtual_api_keys_user ON public.virtual_api_keys USING btree (user_id);


--
-- Name: idx_webhook_events_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_event_id ON public.webhook_events USING btree (event_id);


--
-- Name: idx_webhook_events_processed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_processed_at ON public.webhook_events USING btree (processed_at);


--
-- Name: idx_webhook_events_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_provider ON public.webhook_events USING btree (provider);


--
-- Name: idx_worker_spec_dependency_artifacts_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_spec_dependency_artifacts_snapshot ON public.worker_spec_dependency_artifacts USING btree (worker_spec_snapshot_id);


--
-- Name: idx_worker_spec_snapshots_organization_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_spec_snapshots_organization_created_at ON public.worker_spec_snapshots USING btree (organization_id, created_at DESC);


--
-- Name: idx_workflow_runs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_active ON public.workflow_runs USING btree (workflow_id, status) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying])::text[]));


--
-- Name: idx_workflow_runs_autopilot_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_autopilot_key ON public.workflow_runs USING btree (autopilot_controller_key) WHERE (autopilot_controller_key IS NOT NULL);


--
-- Name: idx_workflow_runs_pod_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_pod_key ON public.workflow_runs USING btree (pod_key) WHERE (pod_key IS NOT NULL);


--
-- Name: idx_workflow_runs_workflow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_workflow_id ON public.workflow_runs USING btree (workflow_id, created_at DESC);


--
-- Name: idx_workflow_runs_workflow_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_workflow_runs_workflow_number ON public.workflow_runs USING btree (workflow_id, run_number);


--
-- Name: idx_workflows_agent_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_agent_slug ON public.workflows USING btree (agent_slug);


--
-- Name: idx_workflows_cron_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_cron_due ON public.workflows USING btree (next_run_at) WHERE (((status)::text = 'enabled'::text) AND (cron_expression IS NOT NULL));


--
-- Name: idx_workflows_model_resource_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_model_resource_id ON public.workflows USING btree (model_resource_id);


--
-- Name: idx_workflows_orchestration_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_workflows_orchestration_resource ON public.workflows USING btree (organization_id, orchestration_resource_id) WHERE (orchestration_resource_id IS NOT NULL);


--
-- Name: idx_workflows_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_workflows_org_slug ON public.workflows USING btree (organization_id, slug);


--
-- Name: idx_workflows_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflows_org_status ON public.workflows USING btree (organization_id, status);


--
-- Name: im_channel_connections_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX im_channel_connections_org ON public.im_channel_connections USING btree (organization_id);


--
-- Name: im_channel_connections_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX im_channel_connections_provider ON public.im_channel_connections USING btree (provider);


--
-- Name: im_channel_connections_webhook_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX im_channel_connections_webhook_token ON public.im_channel_connections USING btree (webhook_token);


--
-- Name: im_identity_bindings_pairing_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX im_identity_bindings_pairing_code_uidx ON public.im_identity_bindings USING btree (pairing_code) WHERE (((status)::text = 'pending'::text) AND (pairing_code IS NOT NULL));


--
-- Name: im_inbound_dedupe_seen_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX im_inbound_dedupe_seen_at_idx ON public.im_inbound_dedupe USING btree (seen_at);


--
-- Name: im_route_bindings_connection_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX im_route_bindings_connection_priority_idx ON public.im_route_bindings USING btree (connection_id, peer_kind, priority);


--
-- Name: im_thread_mappings_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX im_thread_mappings_channel ON public.im_thread_mappings USING btree (channel_id);


--
-- Name: knowledge_base_agent_mounts_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_base_agent_mounts_agent ON public.knowledge_base_agent_mounts USING btree (organization_id, agent_slug);


--
-- Name: knowledge_base_agent_mounts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_base_agent_mounts_org ON public.knowledge_base_agent_mounts USING btree (organization_id);


--
-- Name: knowledge_bases_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_bases_org ON public.knowledge_bases USING btree (organization_id);


--
-- Name: knowledge_bases_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_bases_source_type ON public.knowledge_bases USING btree (source_type);


--
-- Name: repositories_org_provider_path_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX repositories_org_provider_path_unique ON public.repositories USING btree (organization_id, provider_type, provider_base_url, slug) WHERE (deleted_at IS NULL);


--
-- Name: ticket_external_links_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_external_links_ticket ON public.ticket_external_links USING btree (ticket_id);


--
-- Name: uq_pending_cmds_command; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_pending_cmds_command ON public.pending_runner_commands USING btree (command_id);


--
-- Name: uq_token_quotas_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_token_quotas_scope ON public.token_quotas USING btree (organization_id, COALESCE(user_id, (0)::bigint), COALESCE(model, ''::character varying));


--
-- Name: uq_virtual_api_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_virtual_api_keys_hash ON public.virtual_api_keys USING btree (key_hash);


--
-- Name: marketplace_catalog_item_versions marketplace_catalog_version_immutable; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE TRIGGER marketplace_catalog_version_immutable BEFORE DELETE OR UPDATE ON marketplace.marketplace_catalog_item_versions FOR EACH ROW EXECUTE FUNCTION marketplace.prevent_catalog_version_payload_update();


--
-- Name: marketplace_listings marketplace_expert_runtime_compatibility_guard; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE CONSTRAINT TRIGGER marketplace_expert_runtime_compatibility_guard AFTER INSERT OR UPDATE OF status, current_version_id ON marketplace.marketplace_listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION marketplace.validate_expert_runtime_compatibility();


--
-- Name: marketplace_listings marketplace_listing_publication_guard; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE CONSTRAINT TRIGGER marketplace_listing_publication_guard AFTER INSERT OR UPDATE OF status, current_version_id, published_at ON marketplace.marketplace_listings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION marketplace.validate_listing_publication();


--
-- Name: marketplace_listing_spaces marketplace_listing_space_publication_guard; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE CONSTRAINT TRIGGER marketplace_listing_space_publication_guard AFTER DELETE OR UPDATE OF listing_id, is_primary ON marketplace.marketplace_listing_spaces DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION marketplace.validate_listing_publication();


--
-- Name: marketplace_listing_versions marketplace_listing_version_immutable; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE TRIGGER marketplace_listing_version_immutable BEFORE DELETE OR UPDATE ON marketplace.marketplace_listing_versions FOR EACH ROW EXECUTE FUNCTION marketplace.prevent_submitted_listing_version_update();


--
-- Name: marketplace_quota_ledger_entries marketplace_quota_balance_guard; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE TRIGGER marketplace_quota_balance_guard BEFORE INSERT ON marketplace.marketplace_quota_ledger_entries FOR EACH ROW EXECUTE FUNCTION marketplace.enforce_quota_non_negative_balance();


--
-- Name: marketplace_quota_ledger_entries marketplace_quota_ledger_immutable; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE TRIGGER marketplace_quota_ledger_immutable BEFORE DELETE OR UPDATE ON marketplace.marketplace_quota_ledger_entries FOR EACH ROW EXECUTE FUNCTION marketplace.prevent_quota_ledger_mutation();


--
-- Name: marketplace_spaces marketplace_space_publication_guard; Type: TRIGGER; Schema: marketplace; Owner: -
--

CREATE CONSTRAINT TRIGGER marketplace_space_publication_guard AFTER UPDATE OF status ON marketplace.marketplace_spaces DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION marketplace.validate_space_publication();


--
-- Name: agent_workbench_events agent_workbench_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_workbench_events_immutable BEFORE DELETE OR UPDATE ON public.agent_workbench_events FOR EACH ROW EXECUTE FUNCTION public.prevent_agent_workbench_append_only_mutation();


--
-- Name: agent_workbench_source_events agent_workbench_source_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_workbench_source_events_immutable BEFORE DELETE OR UPDATE ON public.agent_workbench_source_events FOR EACH ROW EXECUTE FUNCTION public.prevent_agent_workbench_append_only_mutation();


--
-- Name: expert_market_applications expert_market_applications_validate_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expert_market_applications_validate_source BEFORE INSERT ON public.expert_market_applications FOR EACH ROW EXECUTE FUNCTION public.validate_expert_market_application_source();


--
-- Name: expert_market_releases expert_market_releases_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expert_market_releases_immutable BEFORE UPDATE ON public.expert_market_releases FOR EACH ROW EXECUTE FUNCTION public.prevent_expert_market_release_immutable_update();


--
-- Name: expert_market_releases expert_market_releases_validate_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expert_market_releases_validate_source BEFORE INSERT ON public.expert_market_releases FOR EACH ROW EXECUTE FUNCTION public.validate_expert_market_release_source();


--
-- Name: model_resources keep_model_resource_parent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER keep_model_resource_parent BEFORE UPDATE ON public.model_resources FOR EACH ROW EXECUTE FUNCTION public.keep_ai_resource_parent_invariants();


--
-- Name: provider_connections keep_provider_connection_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER keep_provider_connection_owner BEFORE UPDATE ON public.provider_connections FOR EACH ROW EXECUTE FUNCTION public.keep_ai_resource_parent_invariants();


--
-- Name: orchestration_resource_plans orchestration_resource_plans_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orchestration_resource_plans_guard BEFORE INSERT OR DELETE OR UPDATE ON public.orchestration_resource_plans FOR EACH ROW EXECUTE FUNCTION public.guard_orchestration_resource_plan();


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orchestration_resource_revisions_immutable BEFORE DELETE OR UPDATE ON public.orchestration_resource_revisions FOR EACH ROW EXECUTE FUNCTION public.prevent_orchestration_resource_revision_mutation();


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_validate_head; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER orchestration_resource_revisions_validate_head AFTER INSERT ON public.orchestration_resource_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_orchestration_resource_revision_link();


--
-- Name: orchestration_resources orchestration_resources_keep_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orchestration_resources_keep_identity BEFORE UPDATE ON public.orchestration_resources FOR EACH ROW EXECUTE FUNCTION public.keep_orchestration_resource_identity();


--
-- Name: orchestration_resources orchestration_resources_validate_active_revision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER orchestration_resources_validate_active_revision AFTER INSERT OR UPDATE ON public.orchestration_resources DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_orchestration_resource_revision_link();


--
-- Name: organizations prevent_org_with_provider_connections_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_org_with_provider_connections_delete BEFORE DELETE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.prevent_ai_resource_owner_delete();


--
-- Name: users prevent_user_with_provider_connections_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_user_with_provider_connections_delete BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.prevent_ai_resource_owner_delete();


--
-- Name: agents update_agent_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_types_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: channels update_channels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coordinator_executions update_coordinator_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coordinator_executions_updated_at BEFORE UPDATE ON public.coordinator_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coordinator_projects update_coordinator_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coordinator_projects_updated_at BEFORE UPDATE ON public.coordinator_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custom_agents update_custom_agent_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_custom_agent_types_updated_at BEFORE UPDATE ON public.custom_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: env_bundles update_env_bundles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_env_bundles_updated_at BEFORE UPDATE ON public.env_bundles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: git_providers update_git_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_git_providers_updated_at BEFORE UPDATE ON public.git_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: im_channel_connections update_im_channel_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_im_channel_connections_updated_at BEFORE UPDATE ON public.im_channel_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_bases update_knowledge_bases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON public.knowledge_bases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pod_bindings update_pod_bindings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pod_bindings_updated_at BEFORE UPDATE ON public.pod_bindings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pods update_pods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pods_updated_at BEFORE UPDATE ON public.pods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: promo_codes update_promo_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: repositories update_repositories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_repositories_updated_at BEFORE UPDATE ON public.repositories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: runners update_runners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_runners_updated_at BEFORE UPDATE ON public.runners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ticket_external_links update_ticket_external_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ticket_external_links_updated_at BEFORE UPDATE ON public.ticket_external_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ticket_merge_requests update_ticket_merge_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ticket_merge_requests_updated_at BEFORE UPDATE ON public.ticket_merge_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tickets update_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_git_credentials update_user_git_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_git_credentials_updated_at BEFORE UPDATE ON public.user_git_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_identities update_user_identities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_identities_updated_at BEFORE UPDATE ON public.user_identities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_repository_providers update_user_repository_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_repository_providers_updated_at BEFORE UPDATE ON public.user_repository_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: model_resource_defaults validate_model_resource_default; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_model_resource_default BEFORE INSERT OR UPDATE ON public.model_resource_defaults FOR EACH ROW EXECUTE FUNCTION public.enforce_model_resource_default();


--
-- Name: provider_connections validate_provider_connection_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_provider_connection_owner BEFORE INSERT ON public.provider_connections FOR EACH ROW EXECUTE FUNCTION public.enforce_provider_connection_owner();


--
-- Name: worker_spec_dependency_artifacts worker_spec_dependency_artifacts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER worker_spec_dependency_artifacts_immutable BEFORE UPDATE ON public.worker_spec_dependency_artifacts FOR EACH ROW EXECUTE FUNCTION public.prevent_worker_spec_dependency_artifact_update();


--
-- Name: worker_spec_snapshots worker_spec_snapshots_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER worker_spec_snapshots_immutable BEFORE UPDATE ON public.worker_spec_snapshots FOR EACH ROW EXECUTE FUNCTION public.prevent_worker_spec_snapshot_update();


--
-- Name: marketplace_catalog_items fk_marketplace_catalog_latest_version; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_items
    ADD CONSTRAINT fk_marketplace_catalog_latest_version FOREIGN KEY (latest_version_id, id) REFERENCES marketplace.marketplace_catalog_item_versions(id, catalog_item_id);


--
-- Name: marketplace_installations fk_marketplace_installations_current_operation; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT fk_marketplace_installations_current_operation FOREIGN KEY (id, current_operation_id) REFERENCES marketplace.marketplace_installation_operations(installation_id, id);


--
-- Name: marketplace_listings fk_marketplace_listing_current_version; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT fk_marketplace_listing_current_version FOREIGN KEY (id, current_version_id) REFERENCES marketplace.marketplace_listing_versions(listing_id, id);


--
-- Name: marketplace_listing_versions fk_marketplace_listing_versions_catalog_item; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions
    ADD CONSTRAINT fk_marketplace_listing_versions_catalog_item FOREIGN KEY (catalog_item_version_id, catalog_item_id) REFERENCES marketplace.marketplace_catalog_item_versions(id, catalog_item_id);


--
-- Name: marketplace_listing_versions fk_marketplace_listing_versions_listing_item; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions
    ADD CONSTRAINT fk_marketplace_listing_versions_listing_item FOREIGN KEY (listing_id, catalog_item_id) REFERENCES marketplace.marketplace_listings(id, catalog_item_id);


--
-- Name: marketplace_audit_events marketplace_audit_events_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_audit_events
    ADD CONSTRAINT marketplace_audit_events_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_catalog_item_versions marketplace_catalog_item_versions_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_item_versions
    ADD CONSTRAINT marketplace_catalog_item_versions_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES marketplace.marketplace_catalog_items(id);


--
-- Name: marketplace_catalog_items marketplace_catalog_items_publisher_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_catalog_items
    ADD CONSTRAINT marketplace_catalog_items_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES marketplace.marketplace_publishers(id);


--
-- Name: marketplace_domains marketplace_domains_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_domains
    ADD CONSTRAINT marketplace_domains_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_entitlements marketplace_entitlements_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_entitlements
    ADD CONSTRAINT marketplace_entitlements_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_entitlements marketplace_entitlements_marketplace_id_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_entitlements
    ADD CONSTRAINT marketplace_entitlements_marketplace_id_listing_id_fkey FOREIGN KEY (marketplace_id, listing_id) REFERENCES marketplace.marketplace_listings(marketplace_id, id);


--
-- Name: marketplace_installation_operations marketplace_installation_oper_marketplace_id_installation__fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installation_operations
    ADD CONSTRAINT marketplace_installation_oper_marketplace_id_installation__fkey FOREIGN KEY (marketplace_id, installation_id) REFERENCES marketplace.marketplace_installations(marketplace_id, id);


--
-- Name: marketplace_installation_operations marketplace_installation_operations_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installation_operations
    ADD CONSTRAINT marketplace_installation_operations_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_installations marketplace_installations_listing_id_listing_version_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT marketplace_installations_listing_id_listing_version_id_fkey FOREIGN KEY (listing_id, listing_version_id) REFERENCES marketplace.marketplace_listing_versions(listing_id, id);


--
-- Name: marketplace_installations marketplace_installations_marketplace_id_entitlement_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT marketplace_installations_marketplace_id_entitlement_id_fkey FOREIGN KEY (marketplace_id, entitlement_id) REFERENCES marketplace.marketplace_entitlements(marketplace_id, id);


--
-- Name: marketplace_installations marketplace_installations_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT marketplace_installations_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_installations marketplace_installations_marketplace_id_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT marketplace_installations_marketplace_id_listing_id_fkey FOREIGN KEY (marketplace_id, listing_id) REFERENCES marketplace.marketplace_listings(marketplace_id, id);


--
-- Name: marketplace_installations marketplace_installations_marketplace_id_quota_account_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_installations
    ADD CONSTRAINT marketplace_installations_marketplace_id_quota_account_id_fkey FOREIGN KEY (marketplace_id, quota_account_id) REFERENCES marketplace.marketplace_quota_accounts(marketplace_id, id);


--
-- Name: marketplace_listing_spaces marketplace_listing_spaces_marketplace_id_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_spaces
    ADD CONSTRAINT marketplace_listing_spaces_marketplace_id_listing_id_fkey FOREIGN KEY (marketplace_id, listing_id) REFERENCES marketplace.marketplace_listings(marketplace_id, id);


--
-- Name: marketplace_listing_spaces marketplace_listing_spaces_marketplace_id_space_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_spaces
    ADD CONSTRAINT marketplace_listing_spaces_marketplace_id_space_id_fkey FOREIGN KEY (marketplace_id, space_id) REFERENCES marketplace.marketplace_spaces(marketplace_id, id);


--
-- Name: marketplace_listing_version_tags marketplace_listing_version_t_listing_id_listing_version_i_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_version_tags
    ADD CONSTRAINT marketplace_listing_version_t_listing_id_listing_version_i_fkey FOREIGN KEY (listing_id, listing_version_id) REFERENCES marketplace.marketplace_listing_versions(listing_id, id);


--
-- Name: marketplace_listing_version_tags marketplace_listing_version_t_marketplace_id_taxonomy_tag__fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_version_tags
    ADD CONSTRAINT marketplace_listing_version_t_marketplace_id_taxonomy_tag__fkey FOREIGN KEY (marketplace_id, taxonomy_tag_id) REFERENCES marketplace.marketplace_taxonomy_tags(marketplace_id, id);


--
-- Name: marketplace_listing_version_tags marketplace_listing_version_tags_marketplace_id_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_version_tags
    ADD CONSTRAINT marketplace_listing_version_tags_marketplace_id_listing_id_fkey FOREIGN KEY (marketplace_id, listing_id) REFERENCES marketplace.marketplace_listings(marketplace_id, id);


--
-- Name: marketplace_listing_versions marketplace_listing_versions_catalog_item_version_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions
    ADD CONSTRAINT marketplace_listing_versions_catalog_item_version_id_fkey FOREIGN KEY (catalog_item_version_id) REFERENCES marketplace.marketplace_catalog_item_versions(id);


--
-- Name: marketplace_listing_versions marketplace_listing_versions_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listing_versions
    ADD CONSTRAINT marketplace_listing_versions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES marketplace.marketplace_listings(id);


--
-- Name: marketplace_listings marketplace_listings_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT marketplace_listings_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES marketplace.marketplace_catalog_items(id);


--
-- Name: marketplace_listings marketplace_listings_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_listings
    ADD CONSTRAINT marketplace_listings_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_quota_accounts marketplace_quota_accounts_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_accounts
    ADD CONSTRAINT marketplace_quota_accounts_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_quota_accounts marketplace_quota_accounts_marketplace_id_quota_plan_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_accounts
    ADD CONSTRAINT marketplace_quota_accounts_marketplace_id_quota_plan_id_fkey FOREIGN KEY (marketplace_id, quota_plan_id) REFERENCES marketplace.marketplace_quota_plans(marketplace_id, id);


--
-- Name: marketplace_quota_ledger_entries marketplace_quota_ledger_entr_marketplace_id_quota_account_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_ledger_entries
    ADD CONSTRAINT marketplace_quota_ledger_entr_marketplace_id_quota_account_fkey FOREIGN KEY (marketplace_id, quota_account_id) REFERENCES marketplace.marketplace_quota_accounts(marketplace_id, id);


--
-- Name: marketplace_quota_ledger_entries marketplace_quota_ledger_entr_quota_account_id_reservation_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_ledger_entries
    ADD CONSTRAINT marketplace_quota_ledger_entr_quota_account_id_reservation_fkey FOREIGN KEY (quota_account_id, reservation_id) REFERENCES marketplace.marketplace_quota_reservations(quota_account_id, id);


--
-- Name: marketplace_quota_ledger_entries marketplace_quota_ledger_entri_marketplace_id_operation_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_ledger_entries
    ADD CONSTRAINT marketplace_quota_ledger_entri_marketplace_id_operation_id_fkey FOREIGN KEY (marketplace_id, operation_id) REFERENCES marketplace.marketplace_installation_operations(marketplace_id, id);


--
-- Name: marketplace_quota_ledger_entries marketplace_quota_ledger_entries_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_ledger_entries
    ADD CONSTRAINT marketplace_quota_ledger_entries_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_quota_plans marketplace_quota_plans_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_plans
    ADD CONSTRAINT marketplace_quota_plans_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_quota_reservations marketplace_quota_reservation_marketplace_id_quota_account_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_reservations
    ADD CONSTRAINT marketplace_quota_reservation_marketplace_id_quota_account_fkey FOREIGN KEY (marketplace_id, quota_account_id) REFERENCES marketplace.marketplace_quota_accounts(marketplace_id, id);


--
-- Name: marketplace_quota_reservations marketplace_quota_reservations_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_quota_reservations
    ADD CONSTRAINT marketplace_quota_reservations_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_spaces marketplace_spaces_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_spaces
    ADD CONSTRAINT marketplace_spaces_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_taxonomy_tags marketplace_taxonomy_tags_marketplace_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_taxonomy_tags
    ADD CONSTRAINT marketplace_taxonomy_tags_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace.marketplaces(id);


--
-- Name: marketplace_taxonomy_tags marketplace_taxonomy_tags_marketplace_id_parent_tag_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.marketplace_taxonomy_tags
    ADD CONSTRAINT marketplace_taxonomy_tags_marketplace_id_parent_tag_id_fkey FOREIGN KEY (marketplace_id, parent_tag_id) REFERENCES marketplace.marketplace_taxonomy_tags(marketplace_id, id);


--
-- Name: agent_sessions agent_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: agent_sessions agent_sessions_parent_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_parent_session_id_fkey FOREIGN KEY (parent_session_id) REFERENCES public.agent_sessions(id) ON DELETE SET NULL;


--
-- Name: agent_sessions agent_sessions_pod_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_pod_key_fkey FOREIGN KEY (pod_key) REFERENCES public.pods(pod_key) ON DELETE CASCADE;


--
-- Name: agent_sessions agent_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: agent_workbench_command_receipts agent_workbench_command_receipts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_command_receipts
    ADD CONSTRAINT agent_workbench_command_receipts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_workbench_events agent_workbench_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_events
    ADD CONSTRAINT agent_workbench_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_workbench_session_states agent_workbench_session_states_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_session_states
    ADD CONSTRAINT agent_workbench_session_states_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: agent_workbench_source_events agent_workbench_source_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workbench_source_events
    ADD CONSTRAINT agent_workbench_source_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_models ai_models_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_models ai_models_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_resource_migration_map ai_resource_migration_map_model_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_resource_migration_map
    ADD CONSTRAINT ai_resource_migration_map_model_resource_id_fkey FOREIGN KEY (model_resource_id) REFERENCES public.model_resources(id) ON DELETE SET NULL;


--
-- Name: ai_resource_migration_map ai_resource_migration_map_provider_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_resource_migration_map
    ADD CONSTRAINT ai_resource_migration_map_provider_connection_id_fkey FOREIGN KEY (provider_connection_id) REFERENCES public.provider_connections(id) ON DELETE SET NULL;


--
-- Name: api_keys api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: api_keys api_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: block_embeddings block_embeddings_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_embeddings
    ADD CONSTRAINT block_embeddings_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: block_ops block_ops_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_ops
    ADD CONSTRAINT block_ops_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.block_workspaces(id) ON DELETE CASCADE;


--
-- Name: block_refs block_refs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_refs
    ADD CONSTRAINT block_refs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: block_refs block_refs_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_refs
    ADD CONSTRAINT block_refs_from_id_fkey FOREIGN KEY (from_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: block_refs block_refs_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_refs
    ADD CONSTRAINT block_refs_to_id_fkey FOREIGN KEY (to_id) REFERENCES public.blocks(id);


--
-- Name: block_refs block_refs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_refs
    ADD CONSTRAINT block_refs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.block_workspaces(id) ON DELETE CASCADE;


--
-- Name: block_workspaces block_workspaces_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_workspaces
    ADD CONSTRAINT block_workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: block_workspaces block_workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_workspaces
    ADD CONSTRAINT block_workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: blocks blocks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.block_workspaces(id) ON DELETE CASCADE;


--
-- Name: channel_message_edits channel_message_edits_editor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_message_edits
    ADD CONSTRAINT channel_message_edits_editor_user_id_fkey FOREIGN KEY (editor_user_id) REFERENCES public.users(id);


--
-- Name: channel_messages channel_messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_messages channel_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES public.users(id);


--
-- Name: conversation_items conversation_items_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_items
    ADD CONSTRAINT conversation_items_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: coordinator_executions coordinator_executions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinator_executions
    ADD CONSTRAINT coordinator_executions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.coordinator_projects(id) ON DELETE CASCADE;


--
-- Name: coordinator_projects coordinator_projects_worker_spec_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinator_projects
    ADD CONSTRAINT coordinator_projects_worker_spec_snapshot_id_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- Name: custom_agents custom_agent_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_agents
    ADD CONSTRAINT custom_agent_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: execution_clusters execution_clusters_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_clusters
    ADD CONSTRAINT execution_clusters_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: expert_market_applications expert_market_applications_latest_release_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications
    ADD CONSTRAINT expert_market_applications_latest_release_fkey FOREIGN KEY (id, latest_published_release_id) REFERENCES public.expert_market_releases(application_id, id);


--
-- Name: expert_market_applications expert_market_applications_publisher_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications
    ADD CONSTRAINT expert_market_applications_publisher_organization_id_fkey FOREIGN KEY (publisher_organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: expert_market_applications expert_market_applications_publisher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_applications
    ADD CONSTRAINT expert_market_applications_publisher_user_id_fkey FOREIGN KEY (publisher_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: expert_market_releases expert_market_releases_application_publisher_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases
    ADD CONSTRAINT expert_market_releases_application_publisher_fkey FOREIGN KEY (application_id, publisher_organization_id) REFERENCES public.expert_market_applications(id, publisher_organization_id) ON DELETE CASCADE;


--
-- Name: expert_market_releases expert_market_releases_publisher_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases
    ADD CONSTRAINT expert_market_releases_publisher_organization_id_fkey FOREIGN KEY (publisher_organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: expert_market_releases expert_market_releases_publisher_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases
    ADD CONSTRAINT expert_market_releases_publisher_user_id_fkey FOREIGN KEY (publisher_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: expert_market_releases expert_market_releases_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expert_market_releases
    ADD CONSTRAINT expert_market_releases_reviewer_user_id_fkey FOREIGN KEY (reviewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: experts experts_market_release_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experts
    ADD CONSTRAINT experts_market_release_fkey FOREIGN KEY (source_market_application_id, source_market_release_id) REFERENCES public.expert_market_releases(application_id, id) ON DELETE SET NULL;


--
-- Name: experts experts_orchestration_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experts
    ADD CONSTRAINT experts_orchestration_revision_fkey FOREIGN KEY (organization_id, orchestration_resource_id, orchestration_resource_revision, worker_spec_snapshot_id) REFERENCES public.orchestration_resource_revisions(organization_id, resource_id, revision, worker_spec_snapshot_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: experts experts_worker_spec_snapshot_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.experts
    ADD CONSTRAINT experts_worker_spec_snapshot_org_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- Name: files files_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: files files_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: block_workspaces fk_block_workspaces_root; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_workspaces
    ADD CONSTRAINT fk_block_workspaces_root FOREIGN KEY (root_block_id) REFERENCES public.blocks(id) ON DELETE SET NULL;


--
-- Name: channels fk_channels_ticket; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT fk_channels_ticket FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: pods fk_pods_ticket; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT fk_pods_ticket FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: git_providers git_providers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.git_providers
    ADD CONSTRAINT git_providers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: goal_loops goal_loops_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_loops
    ADD CONSTRAINT goal_loops_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: goal_loops goal_loops_orchestration_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_loops
    ADD CONSTRAINT goal_loops_orchestration_revision_fkey FOREIGN KEY (organization_id, orchestration_resource_id, orchestration_resource_revision, worker_spec_snapshot_id) REFERENCES public.orchestration_resource_revisions(organization_id, resource_id, revision, worker_spec_snapshot_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: goal_loops goal_loops_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_loops
    ADD CONSTRAINT goal_loops_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: goal_loops goal_loops_worker_spec_snapshot_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_loops
    ADD CONSTRAINT goal_loops_worker_spec_snapshot_org_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- Name: im_channel_connections im_channel_connections_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_channel_connections
    ADD CONSTRAINT im_channel_connections_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: im_channel_connections im_channel_connections_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_channel_connections
    ADD CONSTRAINT im_channel_connections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: im_identity_bindings im_identity_bindings_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_identity_bindings
    ADD CONSTRAINT im_identity_bindings_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.im_channel_connections(id) ON DELETE CASCADE;


--
-- Name: im_identity_bindings im_identity_bindings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_identity_bindings
    ADD CONSTRAINT im_identity_bindings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: im_route_bindings im_route_bindings_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_route_bindings
    ADD CONSTRAINT im_route_bindings_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.im_channel_connections(id) ON DELETE CASCADE;


--
-- Name: im_thread_mappings im_thread_mappings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_thread_mappings
    ADD CONSTRAINT im_thread_mappings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: im_thread_mappings im_thread_mappings_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.im_thread_mappings
    ADD CONSTRAINT im_thread_mappings_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.im_channel_connections(id) ON DELETE CASCADE;


--
-- Name: installed_mcp_servers installed_mcp_servers_installed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_mcp_servers
    ADD CONSTRAINT installed_mcp_servers_installed_by_fkey FOREIGN KEY (installed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: installed_mcp_servers installed_mcp_servers_market_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_mcp_servers
    ADD CONSTRAINT installed_mcp_servers_market_item_id_fkey FOREIGN KEY (market_item_id) REFERENCES public.mcp_market_items(id) ON DELETE SET NULL;


--
-- Name: installed_mcp_servers installed_mcp_servers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_mcp_servers
    ADD CONSTRAINT installed_mcp_servers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: installed_mcp_servers installed_mcp_servers_repository_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_mcp_servers
    ADD CONSTRAINT installed_mcp_servers_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE CASCADE;


--
-- Name: installed_skills installed_skills_installed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_skills
    ADD CONSTRAINT installed_skills_installed_by_fkey FOREIGN KEY (installed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: installed_skills installed_skills_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_skills
    ADD CONSTRAINT installed_skills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: installed_skills installed_skills_repository_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_skills
    ADD CONSTRAINT installed_skills_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE CASCADE;


--
-- Name: installed_skills installed_skills_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installed_skills
    ADD CONSTRAINT installed_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE SET NULL;


--
-- Name: invitations invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- Name: invitations invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id);


--
-- Name: knowledge_base_agent_mounts knowledge_base_agent_mounts_knowledge_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_agent_mounts
    ADD CONSTRAINT knowledge_base_agent_mounts_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: knowledge_bases knowledge_bases_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: labels labels_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: labels labels_repository_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE CASCADE;


--
-- Name: licenses licenses_activated_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_activated_org_id_fkey FOREIGN KEY (activated_org_id) REFERENCES public.organizations(id);


--
-- Name: model_resource_defaults model_resource_defaults_model_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_resource_defaults
    ADD CONSTRAINT model_resource_defaults_model_resource_id_fkey FOREIGN KEY (model_resource_id) REFERENCES public.model_resources(id) ON DELETE CASCADE;


--
-- Name: model_resources model_resources_provider_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_resources
    ADD CONSTRAINT model_resources_provider_connection_id_fkey FOREIGN KEY (provider_connection_id) REFERENCES public.provider_connections(id) ON DELETE CASCADE;


--
-- Name: orchestration_resource_plans orchestration_resource_plans_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: orchestration_resource_plans orchestration_resource_plans_base_head_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_base_head_fkey FOREIGN KEY (organization_id, target_resource_id, base_head_uid, target_api_version, target_kind, target_namespace, target_name) REFERENCES public.orchestration_resources(organization_id, id, uid, api_version, kind, namespace, name) ON DELETE CASCADE;


--
-- Name: orchestration_resource_plans orchestration_resource_plans_consumed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_consumed_by_id_fkey FOREIGN KEY (consumed_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: orchestration_resource_plans orchestration_resource_plans_namespace_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_namespace_fkey FOREIGN KEY (organization_id, target_namespace) REFERENCES public.organizations(id, slug) ON DELETE CASCADE;


--
-- Name: orchestration_resource_plans orchestration_resource_plans_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: orchestration_resource_plans orchestration_resource_plans_result_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_result_fkey FOREIGN KEY (organization_id, result_resource_id, result_resource_uid, target_api_version, target_kind, target_namespace, target_name) REFERENCES public.orchestration_resources(organization_id, id, uid, api_version, kind, namespace, name) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: orchestration_resource_plans orchestration_resource_plans_result_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_plans
    ADD CONSTRAINT orchestration_resource_plans_result_revision_fkey FOREIGN KEY (organization_id, result_resource_id, result_revision, result_resource_version) REFERENCES public.orchestration_resource_revisions(organization_id, resource_id, revision, resource_version) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_resource_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_resource_fkey FOREIGN KEY (organization_id, resource_id) REFERENCES public.orchestration_resources(organization_id, id) ON DELETE CASCADE;


--
-- Name: orchestration_resource_revisions orchestration_resource_revisions_snapshot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resource_revisions
    ADD CONSTRAINT orchestration_resource_revisions_snapshot_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- Name: orchestration_resources orchestration_resources_active_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_active_revision_fkey FOREIGN KEY (id, active_revision) REFERENCES public.orchestration_resource_revisions(resource_id, revision) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: orchestration_resources orchestration_resources_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: orchestration_resources orchestration_resources_namespace_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_namespace_fkey FOREIGN KEY (organization_id, namespace) REFERENCES public.organizations(id, slug) ON DELETE CASCADE;


--
-- Name: orchestration_resources orchestration_resources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: orchestration_resources orchestration_resources_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_resources
    ADD CONSTRAINT orchestration_resources_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: orchestration_worker_launches orchestration_worker_launches_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: orchestration_worker_launches orchestration_worker_launches_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: orchestration_worker_launches orchestration_worker_launches_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_plan_fkey FOREIGN KEY (organization_id, plan_id) REFERENCES public.orchestration_resource_plans(organization_id, id) ON DELETE RESTRICT;


--
-- Name: orchestration_worker_launches orchestration_worker_launches_pod_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_pod_fkey FOREIGN KEY (organization_id, pod_id, pod_key) REFERENCES public.pods(organization_id, id, pod_key) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: orchestration_worker_launches orchestration_worker_launches_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_revision_fkey FOREIGN KEY (organization_id, resource_id, resource_revision, worker_spec_snapshot_id) REFERENCES public.orchestration_resource_revisions(organization_id, resource_id, revision, worker_spec_snapshot_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: orchestration_worker_launches orchestration_worker_launches_snapshot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_worker_launches
    ADD CONSTRAINT orchestration_worker_launches_snapshot_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_orders payment_orders_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: payment_orders payment_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_orders payment_orders_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: payment_transactions payment_transactions_payment_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE CASCADE;


--
-- Name: pending_runner_commands pending_runner_commands_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_runner_commands
    ADD CONSTRAINT pending_runner_commands_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE;


--
-- Name: permission_policies permission_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_policies
    ADD CONSTRAINT permission_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: permission_policies permission_policies_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_policies
    ADD CONSTRAINT permission_policies_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: plan_prices plan_prices_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE;


--
-- Name: pod_bindings pod_bindings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_bindings
    ADD CONSTRAINT pod_bindings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: pod_config_revisions pod_config_revisions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_config_revisions
    ADD CONSTRAINT pod_config_revisions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: pod_config_revisions pod_config_revisions_model_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_config_revisions
    ADD CONSTRAINT pod_config_revisions_model_resource_id_fkey FOREIGN KEY (model_resource_id) REFERENCES public.model_resources(id) ON DELETE SET NULL;


--
-- Name: pod_config_revisions pod_config_revisions_pod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pod_config_revisions
    ADD CONSTRAINT pod_config_revisions_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES public.pods(id) ON DELETE CASCADE;


--
-- Name: pods pods_active_config_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_active_config_revision_id_fkey FOREIGN KEY (active_config_revision_id) REFERENCES public.pod_config_revisions(id) ON DELETE SET NULL;


--
-- Name: pods pods_archived_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_archived_by_id_fkey FOREIGN KEY (archived_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pods pods_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: pods pods_execution_cluster_organization_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_execution_cluster_organization_fkey FOREIGN KEY (cluster_id, organization_id) REFERENCES public.execution_clusters(id, organization_id);


--
-- Name: pods pods_model_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_model_resource_id_fkey FOREIGN KEY (model_resource_id) REFERENCES public.model_resources(id) ON DELETE SET NULL;


--
-- Name: pods pods_orchestration_worker_launch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_orchestration_worker_launch_fkey FOREIGN KEY (organization_id, orchestration_worker_launch_id) REFERENCES public.orchestration_worker_launches(organization_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: pods pods_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: pods pods_pending_config_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_pending_config_revision_id_fkey FOREIGN KEY (pending_config_revision_id) REFERENCES public.pod_config_revisions(id) ON DELETE SET NULL;


--
-- Name: pods pods_repository_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE SET NULL;


--
-- Name: pods pods_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE;


--
-- Name: pods pods_virtual_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_virtual_api_key_id_fkey FOREIGN KEY (virtual_api_key_id) REFERENCES public.virtual_api_keys(id) ON DELETE SET NULL;


--
-- Name: pods pods_worker_spec_snapshot_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pods
    ADD CONSTRAINT pods_worker_spec_snapshot_org_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- Name: promo_code_redemptions promo_code_redemptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: promo_code_redemptions promo_code_redemptions_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE RESTRICT;


--
-- Name: promo_code_redemptions promo_code_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: promo_codes promo_codes_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: provider_connections provider_connections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: autopilot_iterations ralph_iterations_ralph_pod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_iterations
    ADD CONSTRAINT ralph_iterations_ralph_pod_id_fkey FOREIGN KEY (autopilot_controller_id) REFERENCES public.autopilot_controllers(id) ON DELETE CASCADE;


--
-- Name: autopilot_controllers ralph_pods_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_controllers
    ADD CONSTRAINT ralph_pods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: autopilot_controllers ralph_pods_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_controllers
    ADD CONSTRAINT ralph_pods_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE;


--
-- Name: autopilot_controllers ralph_pods_worker_pod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autopilot_controllers
    ADD CONSTRAINT ralph_pods_worker_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES public.pods(id) ON DELETE CASCADE;


--
-- Name: repositories repositories_imported_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repositories
    ADD CONSTRAINT repositories_imported_by_user_id_fkey FOREIGN KEY (imported_by_user_id) REFERENCES public.users(id);


--
-- Name: repositories repositories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repositories
    ADD CONSTRAINT repositories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: resource_grants resource_grants_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_grants
    ADD CONSTRAINT resource_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: resource_grants resource_grants_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_grants
    ADD CONSTRAINT resource_grants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: resource_grants resource_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_grants
    ADD CONSTRAINT resource_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: runner_certificates runner_certificates_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_certificates
    ADD CONSTRAINT runner_certificates_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE;


--
-- Name: runner_grpc_registration_tokens runner_grpc_registration_tokens_cluster_organization_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_grpc_registration_tokens
    ADD CONSTRAINT runner_grpc_registration_tokens_cluster_organization_fkey FOREIGN KEY (cluster_id, organization_id) REFERENCES public.execution_clusters(id, organization_id);


--
-- Name: runner_grpc_registration_tokens runner_grpc_registration_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_grpc_registration_tokens
    ADD CONSTRAINT runner_grpc_registration_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: runner_logs runner_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_logs
    ADD CONSTRAINT runner_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: runner_logs runner_logs_requested_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_logs
    ADD CONSTRAINT runner_logs_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public.users(id);


--
-- Name: runner_logs runner_logs_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_logs
    ADD CONSTRAINT runner_logs_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE;


--
-- Name: runner_pending_auths runner_pending_auths_cluster_organization_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_pending_auths
    ADD CONSTRAINT runner_pending_auths_cluster_organization_fkey FOREIGN KEY (cluster_id, organization_id) REFERENCES public.execution_clusters(id, organization_id);


--
-- Name: runner_pending_auths runner_pending_auths_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_pending_auths
    ADD CONSTRAINT runner_pending_auths_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: runner_pending_auths runner_pending_auths_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_pending_auths
    ADD CONSTRAINT runner_pending_auths_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id);


--
-- Name: runner_reactivation_tokens runner_reactivation_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_reactivation_tokens
    ADD CONSTRAINT runner_reactivation_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: runner_reactivation_tokens runner_reactivation_tokens_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_reactivation_tokens
    ADD CONSTRAINT runner_reactivation_tokens_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE;


--
-- Name: runner_grpc_registration_tokens runner_registration_tokens_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_grpc_registration_tokens
    ADD CONSTRAINT runner_registration_tokens_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: runner_grpc_registration_tokens runner_registration_tokens_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runner_grpc_registration_tokens
    ADD CONSTRAINT runner_registration_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: runners runners_execution_cluster_organization_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runners
    ADD CONSTRAINT runners_execution_cluster_organization_fkey FOREIGN KEY (cluster_id, organization_id) REFERENCES public.execution_clusters(id, organization_id);


--
-- Name: runners runners_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runners
    ADD CONSTRAINT runners_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: session_comments session_comments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_comments
    ADD CONSTRAINT session_comments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: session_files session_files_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_files
    ADD CONSTRAINT session_files_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: session_permissions session_permissions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_permissions
    ADD CONSTRAINT session_permissions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: session_read_states session_read_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_read_states
    ADD CONSTRAINT session_read_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sso_configs sso_configs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configs
    ADD CONSTRAINT sso_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: support_ticket_attachments support_ticket_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.support_ticket_messages(id) ON DELETE CASCADE;


--
-- Name: support_ticket_attachments support_ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_attachments support_ticket_attachments_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id);


--
-- Name: support_ticket_messages support_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_messages support_ticket_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: support_tickets support_tickets_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.users(id);


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: system_admin_audit_logs system_admin_audit_logs_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_admin_audit_logs
    ADD CONSTRAINT system_admin_audit_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id);


--
-- Name: ticket_assignees ticket_assignees_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignees
    ADD CONSTRAINT ticket_assignees_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_assignees ticket_assignees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignees
    ADD CONSTRAINT ticket_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ticket_commits ticket_commits_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_commits
    ADD CONSTRAINT ticket_commits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_commits ticket_commits_pod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_commits
    ADD CONSTRAINT ticket_commits_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES public.pods(id) ON DELETE SET NULL;


--
-- Name: ticket_commits ticket_commits_repository_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_commits
    ADD CONSTRAINT ticket_commits_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE CASCADE;


--
-- Name: ticket_commits ticket_commits_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_commits
    ADD CONSTRAINT ticket_commits_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_labels ticket_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_labels
    ADD CONSTRAINT ticket_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: ticket_labels ticket_labels_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_labels
    ADD CONSTRAINT ticket_labels_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_merge_requests ticket_merge_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_merge_requests
    ADD CONSTRAINT ticket_merge_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_merge_requests ticket_merge_requests_pod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_merge_requests
    ADD CONSTRAINT ticket_merge_requests_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES public.pods(id) ON DELETE SET NULL;


--
-- Name: ticket_merge_requests ticket_merge_requests_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_merge_requests
    ADD CONSTRAINT ticket_merge_requests_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_relations ticket_relations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ticket_relations ticket_relations_source_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_source_ticket_id_fkey FOREIGN KEY (source_ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_relations ticket_relations_target_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_relations
    ADD CONSTRAINT ticket_relations_target_ticket_id_fkey FOREIGN KEY (target_ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_parent_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_parent_ticket_id_fkey FOREIGN KEY (parent_ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_repository_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_repository_id_fkey FOREIGN KEY (repository_id) REFERENCES public.repositories(id) ON DELETE CASCADE;


--
-- Name: token_quotas token_quotas_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_quotas
    ADD CONSTRAINT token_quotas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: token_quotas token_quotas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_quotas
    ADD CONSTRAINT token_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: token_usages token_usages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usages
    ADD CONSTRAINT token_usages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: token_usages token_usages_pod_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usages
    ADD CONSTRAINT token_usages_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES public.pods(id) ON DELETE SET NULL;


--
-- Name: token_usages token_usages_runner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usages
    ADD CONSTRAINT token_usages_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE SET NULL;


--
-- Name: token_usages token_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_usages
    ADD CONSTRAINT token_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: usage_records usage_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_agent_configs user_agent_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_agent_configs
    ADD CONSTRAINT user_agent_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_git_credentials user_git_credentials_repository_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_git_credentials
    ADD CONSTRAINT user_git_credentials_repository_provider_id_fkey FOREIGN KEY (repository_provider_id) REFERENCES public.user_repository_providers(id) ON DELETE CASCADE;


--
-- Name: user_git_credentials user_git_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_git_credentials
    ADD CONSTRAINT user_git_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_repository_providers user_repository_providers_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_repository_providers
    ADD CONSTRAINT user_repository_providers_identity_id_fkey FOREIGN KEY (identity_id) REFERENCES public.user_identities(id) ON DELETE SET NULL;


--
-- Name: user_repository_providers user_repository_providers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_repository_providers
    ADD CONSTRAINT user_repository_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_default_git_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_default_git_credential_id_fkey FOREIGN KEY (default_git_credential_id) REFERENCES public.user_git_credentials(id) ON DELETE SET NULL;


--
-- Name: virtual_api_keys virtual_api_keys_model_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.virtual_api_keys
    ADD CONSTRAINT virtual_api_keys_model_resource_id_fkey FOREIGN KEY (model_resource_id) REFERENCES public.model_resources(id) ON DELETE CASCADE;


--
-- Name: virtual_api_keys virtual_api_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.virtual_api_keys
    ADD CONSTRAINT virtual_api_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: virtual_api_keys virtual_api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.virtual_api_keys
    ADD CONSTRAINT virtual_api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: worker_spec_dependency_artifacts worker_spec_dependency_artifacts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_dependency_artifacts
    ADD CONSTRAINT worker_spec_dependency_artifacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: worker_spec_dependency_artifacts worker_spec_dependency_artifacts_worker_spec_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_dependency_artifacts
    ADD CONSTRAINT worker_spec_dependency_artifacts_worker_spec_snapshot_id_fkey FOREIGN KEY (worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(id) ON DELETE RESTRICT;


--
-- Name: worker_spec_snapshots worker_spec_snapshots_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_spec_snapshots
    ADD CONSTRAINT worker_spec_snapshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_orchestration_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_orchestration_revision_fkey FOREIGN KEY (organization_id, orchestration_resource_id, orchestration_resource_revision, worker_spec_snapshot_id) REFERENCES public.orchestration_resource_revisions(organization_id, resource_id, revision, worker_spec_snapshot_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: workflow_runs workflow_runs_worker_spec_snapshot_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_worker_spec_snapshot_org_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- Name: workflows workflows_model_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_model_resource_id_fkey FOREIGN KEY (model_resource_id) REFERENCES public.model_resources(id) ON DELETE SET NULL;


--
-- Name: workflows workflows_orchestration_revision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_orchestration_revision_fkey FOREIGN KEY (organization_id, orchestration_resource_id, orchestration_resource_revision, worker_spec_snapshot_id) REFERENCES public.orchestration_resource_revisions(organization_id, resource_id, revision, worker_spec_snapshot_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: workflows workflows_worker_spec_snapshot_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_worker_spec_snapshot_org_fkey FOREIGN KEY (organization_id, worker_spec_snapshot_id) REFERENCES public.worker_spec_snapshots(organization_id, id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--


