#!/usr/bin/env python3
"""Lab project API CLI.

This CLI does not use browser cookies, password login, or direct database
writes. Provide the platform token through ``--api-key`` or
``ZHIYONG_PLATFORM_API_KEY``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib import error, parse, request


DEFAULT_BASE_URL = "http://127.0.0.1:28071"
DEFAULT_TIMEOUT = 60
PREFIX_LAB = "/api/lab"


def _pretty(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def _read_json_payload(args: argparse.Namespace) -> Dict[str, Any]:
    if args.data and args.data_file:
        raise SystemExit("--data 和 --data-file 只能使用一个")
    if args.data_file:
        payload = json.loads(Path(args.data_file).expanduser().read_text())
    elif args.data:
        payload = json.loads(args.data)
    else:
        payload = json.load(sys.stdin)
    if not isinstance(payload, dict):
        raise SystemExit("项目 payload 必须是 JSON object")
    return payload


def resolve_api_key(args: argparse.Namespace) -> str:
    candidates = [args.api_key, os.environ.get("ZHIYONG_PLATFORM_API_KEY")]
    for candidate in candidates:
        if candidate:
            return candidate.strip()
    raise SystemExit("缺少平台 Token。请传 --api-key，或设置 ZHIYONG_PLATFORM_API_KEY")


class LabProjectClient:
    def __init__(self, base_url: str, api_key: str, timeout: int, lab_prefix: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.lab_prefix = lab_prefix.rstrip("/")

    def _url(self, path: str) -> str:
        if self.lab_prefix:
            return f"{self.base_url}{self.lab_prefix}/{path.lstrip('/')}"
        return f"{self.base_url}/{path.lstrip('/')}"

    def request_json(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        query: Optional[Dict[str, Any]] = None,
        fail_on_http_error: bool = True,
    ) -> Tuple[int, Any]:
        url = self._url(path)
        if query:
            clean = {key: value for key, value in query.items() if value is not None}
            if clean:
                url += "?" + parse.urlencode(clean)
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        req = request.Request(url, data=body, headers=headers, method=method.upper())
        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status, self._parse_body(resp.read())
        except error.HTTPError as exc:
            parsed = self._parse_body(exc.read())
            if fail_on_http_error:
                raise SystemExit(f"{method.upper()} {url} -> HTTP {exc.code}\n{json.dumps(parsed, ensure_ascii=False, indent=2)}") from exc
            return exc.code, parsed

    @staticmethod
    def _parse_body(raw: bytes) -> Any:
        text = raw.decode("utf-8", errors="replace")
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    def list_projects(self) -> Tuple[int, Any]:
        return self.request_json("GET", "projects")

    def create_project(self, payload: Dict[str, Any]) -> Tuple[int, Any]:
        return self.request_json("POST", "projects", payload=payload)

    def update_project(self, project_id: str, payload: Dict[str, Any]) -> Tuple[int, Any]:
        return self.request_json("PUT", f"projects/{project_id}", payload=payload)

    def get_project(self, project_id: str, fail_on_http_error: bool = True) -> Tuple[int, Any]:
        return self.request_json("GET", f"projects/{project_id}", fail_on_http_error=fail_on_http_error)

    def delete_project(self, project_id: str) -> Tuple[int, Any]:
        return self.request_json("DELETE", f"projects/{project_id}")

    def get_instance(self, instance_id: str, fail_on_http_error: bool = True) -> Tuple[int, Any]:
        return self.request_json("GET", f"instances/{instance_id}", fail_on_http_error=fail_on_http_error)

    def destroy_instance(self, instance_id: str, force: bool = False) -> Tuple[int, Any]:
        query = {"force": "true"} if force else None
        return self.request_json("DELETE", f"instances/{instance_id}", query=query)


def api_says_missing(status: int, payload: Any) -> bool:
    if status == 404:
        return True
    if isinstance(payload, dict):
        code = payload.get("code")
        message = str(payload.get("message") or payload.get("msg") or "").lower()
        if code not in (0, 200, "0", "200") and any(token in message for token in ("not found", "不存在", "未找到")):
            return True
    return False


def api_says_destroyed(status: int, payload: Any) -> bool:
    if api_says_missing(status, payload):
        return True
    if status != 200 or not isinstance(payload, dict):
        return False
    data = payload.get("data")
    if not isinstance(data, dict):
        return False
    return data.get("deleted") is True or str(data.get("status") or "").lower() in {"stopped", "destroyed"}


def command_instance_destroy(client: LabProjectClient, args: argparse.Namespace) -> None:
    before_status, before_payload = client.get_instance(args.instance_id, fail_on_http_error=False)
    if api_says_missing(before_status, before_payload):
        _pretty({
            "instance_id": args.instance_id,
            "destroyed": False,
            "verified": True,
            "reason": "instance already missing",
            "before_status": before_status,
        })
        return
    if before_status >= 400:
        raise SystemExit(f"销毁前读取实例失败: HTTP {before_status}\n{json.dumps(before_payload, ensure_ascii=False, indent=2)}")
    if args.dry_run:
        _pretty({
            "instance_id": args.instance_id,
            "dry_run": True,
            "before_status": before_status,
            "instance": before_payload.get("data") if isinstance(before_payload, dict) else before_payload,
        })
        return

    destroy_status, destroy_payload = client.destroy_instance(args.instance_id, force=args.force)
    verify_status, verify_payload = client.get_instance(args.instance_id, fail_on_http_error=False)
    verified = api_says_destroyed(verify_status, verify_payload)
    result = {
        "instance_id": args.instance_id,
        "destroyed": True,
        "verified": verified,
        "destroy_status": destroy_status,
        "destroy_response": destroy_payload,
        "verify_status": verify_status,
        "verify_response": verify_payload,
    }
    _pretty(result)
    if not verified:
        raise SystemExit("销毁接口已返回，但复查实例仍存在")


def command_project_delete(client: LabProjectClient, args: argparse.Namespace) -> None:
    before_status, before_payload = client.get_project(args.project_id, fail_on_http_error=False)
    if api_says_missing(before_status, before_payload):
        _pretty({
            "project_id": args.project_id,
            "deleted": False,
            "verified": True,
            "reason": "project already missing",
            "before_status": before_status,
        })
        return
    if before_status >= 400:
        raise SystemExit(f"删除前读取项目失败: HTTP {before_status}\n{json.dumps(before_payload, ensure_ascii=False, indent=2)}")
    if args.dry_run:
        _pretty({
            "project_id": args.project_id,
            "dry_run": True,
            "before_status": before_status,
            "project": before_payload.get("data") if isinstance(before_payload, dict) else before_payload,
        })
        return

    delete_status, delete_payload = client.delete_project(args.project_id)
    verify_status, verify_payload = client.get_project(args.project_id, fail_on_http_error=False)
    verified = api_says_missing(verify_status, verify_payload)
    result = {
        "project_id": args.project_id,
        "deleted": True,
        "verified": verified,
        "delete_status": delete_status,
        "delete_response": delete_payload,
        "verify_status": verify_status,
        "verify_response": verify_payload,
    }
    _pretty(result)
    if not verified:
        raise SystemExit("删除接口已返回，但复查项目仍存在")


def command_project_create(client: LabProjectClient, args: argparse.Namespace) -> None:
    payload = _read_json_payload(args)
    project_id = str(payload.get("id") or "").strip()
    if not project_id:
        raise SystemExit("创建项目必须提供 id")
    before_status, before_payload = client.get_project(project_id, fail_on_http_error=False)
    if not api_says_missing(before_status, before_payload) and before_status < 400:
        if not args.upsert:
            _pretty({
                "project_id": project_id,
                "created": False,
                "verified": True,
                "reason": "project already exists",
                "project": before_payload.get("data") if isinstance(before_payload, dict) else before_payload,
            })
            return
        raise SystemExit("当前平台 API 未提供项目更新语义，不能用 --upsert 覆盖已有项目")
    if before_status >= 400 and not api_says_missing(before_status, before_payload):
        raise SystemExit(f"创建前读取项目失败: HTTP {before_status}\n{json.dumps(before_payload, ensure_ascii=False, indent=2)}")
    if args.dry_run:
        _pretty({
            "project_id": project_id,
            "dry_run": True,
            "payload": payload,
        })
        return

    create_status, create_payload = client.create_project(payload)
    verify_status, verify_payload = client.get_project(project_id, fail_on_http_error=False)
    verified = verify_status == 200 and not api_says_missing(verify_status, verify_payload)
    result = {
        "project_id": project_id,
        "created": True,
        "verified": verified,
        "create_status": create_status,
        "create_response": create_payload,
        "verify_status": verify_status,
        "verify_response": verify_payload,
    }
    _pretty(result)
    if not verified:
        raise SystemExit("创建接口已返回，但复查项目不存在")


def command_project_update(client: LabProjectClient, args: argparse.Namespace) -> None:
    payload = _read_json_payload(args)
    before_status, before_payload = client.get_project(args.project_id, fail_on_http_error=False)
    if api_says_missing(before_status, before_payload):
        raise SystemExit(f"项目不存在，不能更新: {args.project_id}")
    if before_status >= 400:
        raise SystemExit(f"更新前读取项目失败: HTTP {before_status}\n{json.dumps(before_payload, ensure_ascii=False, indent=2)}")
    if args.dry_run:
        _pretty({
            "project_id": args.project_id,
            "dry_run": True,
            "payload": payload,
        })
        return

    update_status, update_payload = client.update_project(args.project_id, payload)
    verify_status, verify_payload = client.get_project(args.project_id, fail_on_http_error=False)
    verified = verify_status == 200 and not api_says_missing(verify_status, verify_payload)
    result = {
        "project_id": args.project_id,
        "updated": True,
        "verified": verified,
        "update_status": update_status,
        "update_response": update_payload,
        "verify_status": verify_status,
        "verify_response": verify_payload,
    }
    _pretty(result)
    if not verified:
        raise SystemExit("更新接口已返回，但复查项目不存在")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Zhiyong Lab 项目维护 CLI（API Key 认证）")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"平台网关地址，默认 {DEFAULT_BASE_URL}")
    parser.add_argument("--api-key", help="平台 Token。也可使用 ZHIYONG_PLATFORM_API_KEY")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument(
        "--lab-prefix",
        default=PREFIX_LAB,
        help=f"Lab API 路由前缀。网关默认 {PREFIX_LAB}；直连 lab-api 8082 时传空字符串：--lab-prefix ''",
    )

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("project-list", help="列出实验项目")

    create_parser = sub.add_parser("project-create", help="通过 Lab API 创建实验项目并复查")
    create_parser.add_argument("--data", help="项目 JSON payload。未提供 --data/--data-file 时从 stdin 读取")
    create_parser.add_argument("--data-file", help="项目 JSON 文件")
    create_parser.add_argument("--dry-run", action="store_true")
    create_parser.add_argument("--upsert", action="store_true", help="保留参数位；当前 API 无更新语义，不会覆盖已有项目")

    get_parser = sub.add_parser("project-get", help="读取实验项目")
    get_parser.add_argument("project_id")

    update_parser = sub.add_parser("project-update", help="通过 Lab API 更新实验项目并复查")
    update_parser.add_argument("project_id")
    update_parser.add_argument("--data", help="项目更新 JSON payload。未提供 --data/--data-file 时从 stdin 读取")
    update_parser.add_argument("--data-file", help="项目更新 JSON 文件")
    update_parser.add_argument("--dry-run", action="store_true")

    delete_parser = sub.add_parser("project-delete", help="通过 Lab API 删除实验项目并复查")
    delete_parser.add_argument("project_id")
    delete_parser.add_argument("--dry-run", action="store_true")

    instance_get_parser = sub.add_parser("instance-get", help="读取实验实例")
    instance_get_parser.add_argument("instance_id")

    destroy_parser = sub.add_parser("instance-destroy", help="通过 Lab API 销毁实验实例并复查")
    destroy_parser.add_argument("instance_id")
    destroy_parser.add_argument("--force", action="store_true", help="管理员强制销毁白名单实例")
    destroy_parser.add_argument("--dry-run", action="store_true")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    api_key = resolve_api_key(args)
    client = LabProjectClient(args.base_url, api_key, args.timeout, args.lab_prefix)
    if args.command == "project-list":
        _pretty(client.list_projects()[1])
    elif args.command == "project-create":
        command_project_create(client, args)
    elif args.command == "project-get":
        _pretty(client.get_project(args.project_id)[1])
    elif args.command == "project-update":
        command_project_update(client, args)
    elif args.command == "project-delete":
        command_project_delete(client, args)
    elif args.command == "instance-get":
        _pretty(client.get_instance(args.instance_id)[1])
    elif args.command == "instance-destroy":
        command_instance_destroy(client, args)
    else:
        raise SystemExit(f"未知命令: {args.command}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
