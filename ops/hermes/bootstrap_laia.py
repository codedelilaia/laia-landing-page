#!/usr/bin/env python3
"""Bootstrap and recovery helper for the Laia runtime.

This script is intentionally repo-local and dependency-light.
It can:
- verify that required repo/runtime files exist
- install vendored Hermes scripts into ~/.hermes/scripts
- materialize required local secret files from a pass store
- create the current Laia cron jobs via the Hermes CLI
- print next-step commands for Cloudflare/pass setup
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OPS_ROOT = REPO_ROOT / "ops" / "hermes"
SCRIPT_SOURCE_DIR = OPS_ROOT / "scripts"
PASS_LAYOUT_PATH = OPS_ROOT / "pass-layout.json"
CRON_MANIFEST_PATH = OPS_ROOT / "cron-jobs.yaml"
HERMES_HOME = Path.home() / ".hermes"
HERMES_SCRIPTS_DIR = HERMES_HOME / "scripts"
HERMES_CRON_JOBS = HERMES_HOME / "cron" / "jobs.json"

SCRIPT_FILES = [
    "update_laia_dashboard.py",
    "gmail_readonly_watch.py",
]

CRON_JOBS = [
    {
        "name": "Gmail read-only watcher (9:00-17:30)",
        "schedule": "0,30 9-17 * * *",
        "prompt": "Run the Gmail read-only watcher script. The script prints a Telegram-ready email digest only when new, non-spam email is found; empty stdout means send nothing.",
        "script": "gmail_readonly_watch.py",
        "no_agent": True,
        "deliver": "origin",
    },
    {
        "name": "Gmail read-only watcher (18:00)",
        "schedule": "0 18 * * *",
        "prompt": "Run the Gmail read-only watcher script at the end of the workday. The script prints a Telegram-ready email digest only when new, non-spam email is found; empty stdout means send nothing.",
        "script": "gmail_readonly_watch.py",
        "no_agent": True,
        "deliver": "origin",
    },
    {
        "name": "Laia daily work log (midnight)",
        "schedule": "0 0 * * *",
        "prompt": "Create or refresh Laia's daily work log entry for the local calendar day that just ended.\n\nRequirements:\n1. Determine the local date and summarize the day that just finished (at midnight, this is yesterday in local time).\n2. Use session_search to inspect recent Hermes sessions/messages from that day. Combine all meaningful work into one concise daily report.\n3. Focus on completed work, important fixes, decisions, and operational changes. Do not include secrets, tokens, raw tool output, or noisy minutiae.\n4. Produce one JSON object with keys: date, title, summary, bullets. Use 4-8 bullets max.\n5. Publish it by running:\n   /Users/computer/.hermes/hermes-agent/venv/bin/python /Users/computer/.hermes/scripts/update_laia_dashboard.py --daily-log-entry '<JSON>'\n6. If there was clearly no meaningful tracked work that day, do nothing and exit with a brief one-line explanation.\n7. The remote GitHub repo state is authoritative. Do not hand-edit the website; use the updater script only.\n\nOutput style if you do publish: one short human sentence confirming the date logged.",
        "script": None,
        "no_agent": False,
        "deliver": "local",
    },
]


def load_pass_layout() -> dict:
    return json.loads(PASS_LAYOUT_PATH.read_text())


def expand_target(path_str: str) -> Path:
    return Path(path_str).expanduser()


def file_mode(path: Path) -> str:
    return oct(stat.S_IMODE(path.stat().st_mode)) if path.exists() else "missing"


def run(cmd: list[str], check: bool = True, capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def hermes_bin() -> str:
    candidates = [
        shutil.which("hermes"),
        str(HERMES_HOME / "hermes-agent" / "venv" / "bin" / "hermes"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise SystemExit("Could not find Hermes CLI. Install Hermes or adjust hermes_bin() in bootstrap_laia.py")


def check_repo_files() -> list[str]:
    missing = []
    for rel in [
        Path("index.html"),
        Path("_worker.js"),
        Path("wrangler.jsonc"),
        Path("dashboard.json"),
        Path("docs/LAIA_RUNTIME_INDEX.md"),
        Path("docs/LAIA_OPERATING_MANUAL.md"),
        Path("docs/LAIA_SECRET_RECOVERY.md"),
        Path("ops/hermes/cron-jobs.yaml"),
        Path("ops/hermes/pass-layout.json"),
    ]:
        if not (REPO_ROOT / rel).exists():
            missing.append(str(rel))
    for name in SCRIPT_FILES:
        if not (SCRIPT_SOURCE_DIR / name).exists():
            missing.append(str(Path("ops/hermes/scripts") / name))
    return missing


def check_local_secret_files() -> list[dict]:
    issues = []
    for entry in load_pass_layout()["entries"]:
        target_path = entry.get("target_path")
        if not target_path:
            continue
        path = expand_target(target_path)
        if not path.exists():
            issues.append({"entry": entry["entry"], "target": str(path), "status": "missing"})
        else:
            issues.append({"entry": entry["entry"], "target": str(path), "status": "ok", "mode": file_mode(path)})
    return issues


def install_scripts(force: bool = False) -> list[str]:
    HERMES_SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    copied = []
    for name in SCRIPT_FILES:
        src = SCRIPT_SOURCE_DIR / name
        dst = HERMES_SCRIPTS_DIR / name
        if dst.exists() and not force:
            continue
        shutil.copy2(src, dst)
        dst.chmod(0o755)
        copied.append(str(dst))
    return copied


def pass_available() -> tuple[bool, bool]:
    return shutil.which("pass") is not None, shutil.which("gpg") is not None


def pass_show(entry_name: str) -> str:
    result = run(["pass", "show", entry_name], capture=True)
    return result.stdout


def materialize_secrets_from_pass(overwrite: bool = False) -> list[str]:
    has_pass, has_gpg = pass_available()
    if not has_pass or not has_gpg:
        raise SystemExit("pass/gpg not available. Install both first before materializing secrets from pass.")

    writes = []
    for entry in load_pass_layout()["entries"]:
        target_path = entry.get("target_path")
        if not target_path:
            continue
        target = expand_target(target_path)
        if target.exists() and not overwrite:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        content = pass_show(entry["entry"])
        if entry["kind"] == "text":
            content = content.strip() + "\n"
        target.write_text(content)
        os.chmod(target, 0o600)
        writes.append(str(target))
    return writes


def existing_cron_names() -> set[str]:
    if not HERMES_CRON_JOBS.exists():
        return set()
    payload = json.loads(HERMES_CRON_JOBS.read_text())
    return {job.get("name", "") for job in payload.get("jobs", [])}


def create_cron_jobs(skip_existing: bool = True) -> list[str]:
    created = []
    existing = existing_cron_names()
    hermes = hermes_bin()
    for job in CRON_JOBS:
        if skip_existing and job["name"] in existing:
            continue
        cmd = [
            hermes,
            "cron",
            "create",
            job["schedule"],
            job["prompt"],
            "--name",
            job["name"],
            "--deliver",
            job["deliver"],
        ]
        if job["script"]:
            cmd.extend(["--script", job["script"]])
        if job["no_agent"]:
            cmd.append("--no-agent")
        run(cmd)
        created.append(job["name"])
    return created


def print_pass_setup() -> None:
    print("Recommended recoverable secret store: pass (https://www.passwordstore.org/)")
    print("Required layout:")
    for entry in load_pass_layout()["entries"]:
        if entry.get("target_path"):
            print(f"- {entry['entry']} -> {entry['target_path']}")
        else:
            print(f"- {entry['entry']} -> env:{entry['target_env']}")
    print("\nTypical bootstrap on macOS:")
    print("- brew install pass gnupg")
    print("- gpg --full-generate-key")
    print(' - pass init "<your gpg key id or email>"')
    print("- pass git init")
    print("- use a private git remote for ~/.password-store")


def print_cloudflare_secret_command() -> None:
    print("Cloudflare Worker secret to set:")
    print("- GITHUB_TOKEN")
    print("Example after retrieving from pass:")
    print("  pass show laia/cloudflare/github-token | wrangler secret put GITHUB_TOKEN")


def do_check() -> int:
    repo_missing = check_repo_files()
    secret_status = check_local_secret_files()
    has_pass, has_gpg = pass_available()

    print(f"Repo root: {REPO_ROOT}")
    print(f"Hermes home: {HERMES_HOME}")
    print(f"Cron manifest: {CRON_MANIFEST_PATH}")
    print()

    if repo_missing:
        print("Missing repo files:")
        for item in repo_missing:
            print(f"- {item}")
    else:
        print("Repo files: OK")

    print()
    print("Local secret file status:")
    for item in secret_status:
        extra = f" mode={item['mode']}" if item.get("mode") else ""
        print(f"- {item['entry']}: {item['status']} -> {item['target']}{extra}")

    print()
    print(f"pass available: {'yes' if has_pass else 'no'}")
    print(f"gpg available: {'yes' if has_gpg else 'no'}")
    print(f"Hermes CLI available: {'yes' if shutil.which('hermes') or Path(HERMES_HOME / 'hermes-agent' / 'venv' / 'bin' / 'hermes').exists() else 'no'}")

    return 1 if repo_missing else 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true", help="Verify repo/runtime prerequisites")
    p.add_argument("--install-scripts", action="store_true", help="Copy vendored scripts into ~/.hermes/scripts")
    p.add_argument("--force", action="store_true", help="Allow overwriting existing target files for install/materialize")
    p.add_argument("--materialize-secrets-from-pass", action="store_true", help="Write required local secret files from pass entries")
    p.add_argument("--install-cron", action="store_true", help="Create the current Laia cron jobs via Hermes CLI")
    p.add_argument("--print-pass-setup", action="store_true", help="Print recommended pass layout and setup steps")
    p.add_argument("--print-cloudflare-secret-command", action="store_true", help="Print the wrangler secret command using pass")
    p.add_argument("--all", action="store_true", help="Run check + install-scripts + install-cron")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    did_something = False

    if args.check or args.all:
        did_something = True
        check_code = do_check()
        if check_code and not args.all:
            return check_code

    if args.install_scripts or args.all:
        did_something = True
        copied = install_scripts(force=args.force)
        print("Installed scripts:" if copied else "Installed scripts: nothing to do")
        for path in copied:
            print(f"- {path}")

    if args.materialize_secrets_from_pass:
        did_something = True
        written = materialize_secrets_from_pass(overwrite=args.force)
        print("Materialized secret files:" if written else "Materialized secret files: nothing to do")
        for path in written:
            print(f"- {path}")

    if args.install_cron or args.all:
        did_something = True
        created = create_cron_jobs(skip_existing=True)
        print("Created cron jobs:" if created else "Created cron jobs: nothing to do")
        for name in created:
            print(f"- {name}")

    if args.print_pass_setup:
        did_something = True
        print_pass_setup()

    if args.print_cloudflare_secret_command:
        did_something = True
        print_cloudflare_secret_command()

    if not did_something:
        print("Nothing selected. Try --check, --install-scripts, --install-cron, --materialize-secrets-from-pass, or --all.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
