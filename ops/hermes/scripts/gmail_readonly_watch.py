#!/usr/bin/env python3
"""Silent Gmail read-only watcher for Hermes cron.

Outputs a Telegram-ready digest only when new, non-obvious-spam email arrives.
Outputs nothing when there is nothing worth notifying about.
Uses Gmail API readonly OAuth token at ~/.hermes/gmail_readonly_token.json.
"""
import base64
import collections
import datetime as dt
import email.utils
import html
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request

HOME = Path.home() / ".hermes"
TOKEN_PATH = HOME / "gmail_readonly_token.json"
CLIENT_PATH = HOME / "google_client_secret.json"
STATE_PATH = HOME / "mail" / "gmail_watch_state.json"
LANDING_REPO = Path.home() / "laia-landing-page"
DASHBOARD_PATH = LANDING_REPO / "dashboard.json"
GITHUB_PAT_PATH = HOME / "secrets" / "github_pat_codedelilaia.txt"
TOKEN_URI = "https://oauth2.googleapis.com/token"
GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
ACCESS_ALIAS = "brian+laia@maxplanck.dev"

# Obvious low-value senders/categories. Keep this conservative so client mail is not dropped.
AUTOMATED_PATTERNS = (
    "no-reply", "noreply", "donotreply", "do-not-reply", "mailer-daemon", "bounce@",
    "notification@", "notifications@", "updates@", "newsletter", "digest", "alerts@",
    "calendar-notification", "drive-shares", "gemini-notes@google.com",
)
LOW_VALUE_DOMAINS = {
    "e.read.ai", "email.claude.com", "mail.anthropic.com", "stripe.com", "paypal.com",
    "mail.synchronybank.com", "servicing.synchrony.com", "quora.com", "e.fiverr.com",
    "notify.cloudflare.com", "github.com", "calendar.luma-mail.com", "user.luma-mail.com",
}
NON_ACTIONABLE_DOMAINS = {
    "paypal.com", "mail.synchronybank.com", "servicing.synchrony.com", "notify.cloudflare.com", "github.com",
}
OWN_ADDRESSES = {"brian@maxplanck.dev", "brian+hume@maxplanck.dev", "brian+laia@maxplanck.dev"}
LOW_VALUE_LABELS = {"CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "SPAM", "TRASH"}
ACTION_WORDS = re.compile(
    r"\b(please|pls|can you|could you|would you|need|needs|needed|confirm|review|approve|"
    r"send|share|reply|respond|available|availability|schedule|reschedule|question|questions|"
    r"blocked|blocker|urgent|asap|action|decide|decision|feedback|proposal|contract|invoice|pay|payment|"
    r"por favor|puedes|podr[ií]as|necesito|necesitamos|confirmar|revisar|aprobar|enviar|responder|"
    r"disponible|disponibilidad|reagendar|pregunta|bloqueado|urgente|propuesta|contrato|factura|pago)\b",
    re.I,
)


def load_client():
    data = json.loads(CLIENT_PATH.read_text())
    cfg = data.get("installed") or data.get("web") or data
    return cfg["client_id"], cfg.get("client_secret", "")


def access_token():
    tok = json.loads(TOKEN_PATH.read_text())
    if GMAIL_SCOPE not in " ".join(tok.get("scope", "").split()):
        raise RuntimeError("Stored Gmail token is not readonly-scoped as expected")
    if tok.get("access_token") and time.time() < tok.get("created_at", 0) + tok.get("expires_in", 0) - 90:
        return tok["access_token"]
    cid, secret = load_client()
    data = {"client_id": cid, "refresh_token": tok["refresh_token"], "grant_type": "refresh_token"}
    if secret:
        data["client_secret"] = secret
    req = urllib.request.Request(
        TOKEN_URI,
        data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        new = json.loads(resp.read().decode())
    tok.update(new)
    tok["created_at"] = int(time.time())
    TOKEN_PATH.write_text(json.dumps(tok, indent=2))
    os.chmod(TOKEN_PATH, 0o600)
    return tok["access_token"]


def gmail_api(path, params=None):
    url = "https://gmail.googleapis.com/gmail/v1/users/me/" + path
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + access_token()})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode())


def header(headers, name):
    lname = name.lower()
    for h in headers:
        if h.get("name", "").lower() == lname:
            return h.get("value", "")
    return ""


def parse_addr(value):
    name, addr = email.utils.parseaddr(value or "")
    return name, addr.lower()


def domain(addr):
    return addr.split("@")[-1].lower() if "@" in addr else ""


def clean_snippet(s):
    s = html.unescape(s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def sent_to_access_alias(row):
    recipients = " ".join([row.get("to", ""), row.get("cc", "")]).lower()
    return ACCESS_ALIAS in recipients


def is_self_authored(row):
    from_addr = (row.get("from_addr") or "").lower()
    from_name = (row.get("from_name") or "").lower()
    return from_addr in OWN_ADDRESSES or (from_addr.endswith("@maxplanck.dev") and "brian" in from_name)


def addressed_to_user(row):
    recipients = " ".join([row.get("to", ""), row.get("cc", "")]).lower()
    return any(addr in recipients for addr in OWN_ADDRESSES)


def suggested_reply(row):
    frm = (row.get("from_addr") or "").lower()
    subj = (row.get("subject") or "").lower()
    text = f"{subj} {row.get('snippet', '')}".lower()

    if "aironheads.com" in frm or "virtual assistant" in text or "ifema" in text:
        return "Thanks Ruben — understood. Let's leave this parked for now and pick it back up if the client re-engages closer to IFEMA."
    if "colorfarmmedia.com" in frm or "dharma" in text:
        return "Thanks Ben — this works for me. I'll come prepared to review the app setup requirements and next implementation steps."
    if "nmi.com" in frm or "swipesum.com" in frm or "payment" in text or "kyc" in text:
        return "Thanks — let's set up a support call to resolve the cross-organization payments and KYC questions, then align on the next implementation step."
    if "uanaknow" in text or "sagastume" in text:
        return "Thanks — happy to review Sagastume as soon as you are ready. Send over scope, timing, and any materials and I can turn it around quickly."
    if "monostate" in text:
        return "Thanks — I can take this on in the current sprint. Send me the priority and any constraints and I'll move it forward."
    return "Thanks — got it. I'll review this and come back with the next step shortly."


def load_state():
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not STATE_PATH.exists():
        # First run is baseline only; do not dump historical mail.
        now_ms = int(time.time() * 1000)
        state = {"last_check_ms": now_ms, "seen_ids": []}
        STATE_PATH.write_text(json.dumps(state, indent=2))
        return state, True
    return json.loads(STATE_PATH.read_text()), False


def save_state(state):
    state["seen_ids"] = list(dict.fromkeys(state.get("seen_ids", [])))[-2000:]
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(STATE_PATH)


def load_dashboard():
    if DASHBOARD_PATH.exists():
        return json.loads(DASHBOARD_PATH.read_text())
    return {
        "owner": "Laia",
        "headline": "I am Laia, I’ll build this website.",
        "last_updated": None,
        "modules": [],
    }


def upsert_module(modules, payload):
    for i, item in enumerate(modules):
        if item.get("id") == payload.get("id"):
            modules[i] = payload
            return
    modules.append(payload)


def safe_email_line(row):
    who = row.get("from_name") or row.get("from_addr") or row.get("from") or "Unknown sender"
    subject = (row.get("subject") or "(no subject)").strip()
    snippet = clean_snippet(row.get("snippet", ""))
    snippet = snippet[:120] + ("…" if len(snippet) > 120 else "")
    if action_items(row):
        return f"Needs reply: {subject} — {who}. {snippet} Suggested reply: {suggested_reply(row)}"
    if snippet:
        return f"FYI: {subject} — {who}. {snippet}"
    return f"FYI: {subject} — {who}."


def sync_dashboard(rows, action, dashboard_note):
    import subprocess
    items = [safe_email_line(r) for r in (action[:5] or rows[:5])] if rows else []
    subprocess.run(
        [
            sys.executable,
            str(HOME / "scripts" / "update_laia_dashboard.py"),
            "--email-status",
            "attention" if rows else "idle",
            "--email-summary",
            dashboard_note,
            "--email-items",
            json.dumps(items),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def publish_dashboard():
    return


def list_recent_ids():
    ids, page = [], None
    # Pull a 2-day window and client-side filter by internalDate/seen IDs.
    # Include all mail, not just unread; user wants a company email watcher.
    while True:
        params = {"q": "newer_than:2d", "maxResults": 100}
        if page:
            params["pageToken"] = page
        data = gmail_api("messages", params)
        ids.extend([m["id"] for m in data.get("messages", [])])
        page = data.get("nextPageToken")
        if not page or len(ids) >= 500:
            return ids


def fetch_metadata(mid):
    msg = gmail_api(
        "messages/" + mid,
        {
            "format": "metadata",
            "metadataHeaders": ["From", "To", "Cc", "Subject", "Date", "List-Unsubscribe", "Auto-Submitted", "Precedence"],
        },
    )
    headers = msg.get("payload", {}).get("headers", [])
    from_name, from_addr = parse_addr(header(headers, "From"))
    row = {
        "id": mid,
        "threadId": msg.get("threadId"),
        "internalDate": int(msg.get("internalDate", "0")),
        "labelIds": msg.get("labelIds", []),
        "from_name": from_name,
        "from_addr": from_addr,
        "from": header(headers, "From"),
        "to": header(headers, "To"),
        "cc": header(headers, "Cc"),
        "subject": header(headers, "Subject") or "(no subject)",
        "date": header(headers, "Date"),
        "snippet": clean_snippet(msg.get("snippet", "")),
        "list_unsub": bool(header(headers, "List-Unsubscribe")),
        "auto_submitted": header(headers, "Auto-Submitted"),
        "precedence": header(headers, "Precedence"),
    }
    return row


def is_noise(row):
    labels = set(row.get("labelIds", []))
    if labels & LOW_VALUE_LABELS:
        return True
    frm = (row.get("from_addr", "") + " " + row.get("from", "")).lower()
    subj = row.get("subject", "").lower()
    dom = domain(row.get("from_addr", ""))
    if dom in LOW_VALUE_DOMAINS and not ACTION_WORDS.search(subj + " " + row.get("snippet", "")):
        return True
    if any(p in frm for p in AUTOMATED_PATTERNS):
        return True
    if row.get("list_unsub") and not ACTION_WORDS.search(subj + " " + row.get("snippet", "")):
        return True
    if row.get("auto_submitted") and row["auto_submitted"].lower() != "no":
        return True
    if row.get("precedence", "").lower() in {"bulk", "list", "junk"}:
        return True
    return False


def action_items(row):
    if is_self_authored(row):
        return False
    if domain(row.get("from_addr", "")) in NON_ACTIONABLE_DOMAINS:
        return False
    text = row.get("subject", "") + " " + row.get("snippet", "")
    if ACTION_WORDS.search(text):
        return True
    # Human direct mail in inbox is often worth surfacing even without explicit action words.
    if "INBOX" in row.get("labelIds", []) and not row.get("list_unsub"):
        return True
    return False


def main():
    state, first = load_state()
    if first:
        return 0
    last = int(state.get("last_check_ms", 0))
    seen = set(state.get("seen_ids", []))
    now_ms = int(time.time() * 1000)
    # Small overlap handles clock/race issues; seen IDs prevent duplicates.
    cutoff = max(0, last - 5 * 60 * 1000)

    ids = list_recent_ids()
    rows = []
    max_seen_date = last
    for mid in ids:
        if mid in seen:
            continue
        row = fetch_metadata(mid)
        max_seen_date = max(max_seen_date, row.get("internalDate", 0))
        if row.get("internalDate", 0) <= cutoff:
            seen.add(mid)
            continue
        seen.add(mid)
        if is_noise(row) or sent_to_access_alias(row) or is_self_authored(row) or not addressed_to_user(row):
            continue
        rows.append(row)

    state["seen_ids"] = list(seen)
    state["last_check_ms"] = max(now_ms, max_seen_date)
    save_state(state)

    rows.sort(key=lambda r: r["internalDate"])
    action = [r for r in rows if action_items(r)]
    FYI = [r for r in rows if r not in action]

    if rows:
        dashboard_note = f"{len(rows)} new non-spam email(s); {len(action)} likely need attention."
    else:
        dashboard_note = "No new non-spam email at the latest check."
    sync_dashboard(rows, action, dashboard_note)
    publish_dashboard()

    if not rows:
        return 0

    lines = ["📬 **Email update**"]
    if action:
        lines.append("\n**Action / attention likely needed:**")
        for r in action[:10]:
            who = r.get("from_name") or r.get("from_addr") or r.get("from")
            lines.append(f"- **{r['subject']}** — {who}: {r['snippet'][:220]}")
            lines.append(f"  Suggested reply: {suggested_reply(r)}")
    if FYI:
        lines.append("\n**FYI:**")
        for r in FYI[:6]:
            who = r.get("from_name") or r.get("from_addr") or r.get("from")
            lines.append(f"- **{r['subject']}** — {who}: {r['snippet'][:220]}")
    if len(rows) > len(action[:10]) + len(FYI[:6]):
        lines.append(f"\nPlus {len(rows) - len(action[:10]) - len(FYI[:6])} more non-spam messages.")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        # Non-zero alerts the user that the watcher is broken instead of failing silently.
        print(f"Gmail watcher error: {type(e).__name__}: {e}", file=sys.stderr)
        raise
