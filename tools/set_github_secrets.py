"""Puts the worker's credentials into the repository's GitHub Actions secrets.

The scheduled worker (`.github/workflows/worker-cron.yml`) reads
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the repository's
Actions secrets. Without them the workflow stops at its own guard step
before the worker ever runs - which is what happened for every run since
the cron was first enabled: the job was red, and no notice was ever
written.

GitHub never accepts a plaintext secret. It publishes a per-repository
public key and wants the value sealed with it (libsodium's
`crypto_box_seal`). This tool does exactly that, so the owner can run it
once and the cron comes alive.

Usage (from the repository root):

    python tools/set_github_secrets.py

It reads:

  * the values from `.env` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  * a GitHub token from the git credential helper (`git credential fill`),
    which is the same token that `git push` already uses - it needs the
    `repo` scope.

Nothing is printed except the names of the secrets and the HTTP status.
The values are never echoed, and they never leave the machine except
inside GitHub's own encryption.

Requires `pynacl`:  python -m pip install pynacl
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

REPO = os.environ.get("GBU_REPO", "acro777x/gbu-one")
API = "https://api.github.com"

# The secrets the workflows need. A secret that is not in `.env` is
# skipped with a clear message rather than silently written as an empty
# string (an empty secret makes the workflow fail again, one step later).
WANTED = {
    "SUPABASE_URL": "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY": "SUPABASE_SERVICE_ROLE_KEY",
    "EXPO_ACCESS_TOKEN": "EXPO_ACCESS_TOKEN",
    "WORKER_CONTACT_EMAIL": "WORKER_CONTACT_EMAIL",
}


def read_env(path: str = ".env") -> dict[str, str]:
    """Reads a .env file into a dict. Values keep their case."""
    values: dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, _, value = line.partition("=")
                values[name.strip()] = value.strip().strip('"').strip("'")
    except FileNotFoundError:
        print(f"::error::{path} not found - run this from the repository root.")
        sys.exit(1)
    return values


def github_token() -> str:
    """The token the git credential helper already holds for github.com."""
    try:
        raw = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n\n",
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        ).stdout
    except Exception as error:  # noqa: BLE001 - any failure means no token
        print(f"::error::could not read the git credentials: {error}")
        sys.exit(1)
    for line in raw.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1].strip()
    print("::error::the git credential helper holds no password for github.com.")
    sys.exit(1)


def api(method: str, path: str, token: str, body: dict | None = None):
    """One GitHub REST call."""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(f"{API}{path}", data=data, method=method)
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("User-Agent", "gbu-one")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8", "replace")
            return response.status, raw
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace")


def main() -> int:
    try:
        from nacl.public import PublicKey, SealedBox  # type: ignore
    except ImportError:
        print("::error::pynacl is not installed. Run: python -m pip install pynacl")
        return 1

    token = github_token()
    env = read_env()

    status, body = api("GET", f"/repos/{REPO}/actions/secrets/public-key", token)
    if status != 200:
        print(f"::error::could not read the repository public key: HTTP {status} {body[:200]}")
        return 1
    key_info = json.loads(body)
    public_key = base64.b64decode(key_info["key"])
    key_id = key_info["key_id"]

    problems = 0
    for secret_name, env_name in WANTED.items():
        value = env.get(env_name, "")
        if not value:
            print(f"  skip  {secret_name} (no {env_name} in .env)")
            continue
        sealed = SealedBox(PublicKey(public_key)).encrypt(value.encode("utf-8"))
        status, body = api(
            "PUT",
            f"/repos/{REPO}/actions/secrets/{secret_name}",
            token,
            {
                "encrypted_value": base64.b64encode(sealed).decode("ascii"),
                "key_id": key_id,
            },
        )
        if status in (200, 201, 204):
            # 201 when the secret is created, 204 when it is replaced.
            print(f"  set   {secret_name} (HTTP {status})")
        else:
            problems += 1
            print(f"  FAIL  {secret_name}: HTTP {status} {body[:200]}")

    status, body = api("GET", f"/repos/{REPO}/actions/secrets", token)
    if status == 200:
        names = [s["name"] for s in json.loads(body).get("secrets", [])]
        print(f"\nsecrets in {REPO}: {', '.join(names) if names else '(none)'}")

    if problems:
        print("\n::error::one or more secrets could not be written.")
        return 1
    print("\nNow trigger the worker once to prove it works:")
    print("  GitHub -> Actions -> 'Worker cron (notices)' -> Run workflow")
    return 0


if __name__ == "__main__":
    sys.exit(main())
