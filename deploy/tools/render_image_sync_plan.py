#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import pathlib
from typing import Any

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE_VALUES = ROOT / "deploy" / "helm" / "agentsmesh" / "values.yaml"
SOURCE_REGISTRY = "docker.cnb.cool/l8ai/doworker"
SERVICES = ("backend", "web", "relay")


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_values(environment: str) -> dict[str, Any]:
    env_values = ROOT / "deploy" / "environments" / environment / "values.yaml"
    if not env_values.exists():
        raise SystemExit(f"unknown environment values: {env_values}")
    base = yaml.safe_load(BASE_VALUES.read_text(encoding="utf-8"))
    override = yaml.safe_load(env_values.read_text(encoding="utf-8"))
    return deep_merge(base, override)


def render_plan(environment: str) -> list[dict[str, str]]:
    values = load_values(environment)
    default_tag = values["imageTag"]
    plan: list[dict[str, str]] = []
    for service in SERVICES:
        cfg = values[service]
        if not cfg.get("enabled", True):
            continue
        image = cfg["image"]
        image_name = image["name"]
        tag = image.get("tag") or default_tag
        source = f"{SOURCE_REGISTRY}/{image_name}:{tag}"
        target = f"{image['repository']}:{tag}"
        if source == target:
            continue
        plan.append(
            {
                "service": service,
                "imageName": image_name,
                "tag": tag,
                "source": source,
                "target": target,
            }
        )
    return plan


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render AgentsMesh pre-Helm image sync plan from Helm values."
    )
    parser.add_argument("environment", help="environment under deploy/environments")
    parser.add_argument(
        "--format",
        choices=("json", "pairs"),
        default="json",
        help="json array or source|target pairs",
    )
    args = parser.parse_args()

    plan = render_plan(args.environment)
    if args.format == "pairs":
        for item in plan:
            print(f"{item['source']}|{item['target']}")
        return
    print(json.dumps(plan, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
