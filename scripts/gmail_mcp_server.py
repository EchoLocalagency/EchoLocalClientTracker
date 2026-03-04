#!/usr/bin/env python3
"""
Gmail MCP Server
================
Minimal MCP server over stdio (JSON-RPC 2.0).
Uses the existing gmail_token.json OAuth credentials.

Tools:
  - send_email: Send an HTML or plain-text email via Gmail API.

Register in ~/.claude.json:
  "gmail": {
    "type": "stdio",
    "command": "python3",
    "args": ["/Users/brianegan/EchoLocalClientTracker/scripts/gmail_mcp_server.py"]
  }
"""

import base64
import io
import json
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

# Force binary stdout so \r\n is preserved in Content-Length headers
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, newline="")
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, newline="")

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

TOKEN_PATH = Path("/Users/brianegan/EchoLocalClientTracker/gmail_token.json")
SENDER = "brian@echolocalagency.com"
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

SERVER_INFO = {
    "name": "gmail",
    "version": "1.0.0",
}

TOOLS = [
    {
        "name": "send_email",
        "description": (
            "Send an email from brian@echolocalagency.com via Gmail API. "
            "Supports HTML body. Returns the Gmail message ID on success."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "string",
                    "description": "Recipient email address",
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line",
                },
                "body": {
                    "type": "string",
                    "description": "Email body (HTML supported)",
                },
                "is_html": {
                    "type": "boolean",
                    "description": "If true, body is treated as HTML. Default true.",
                    "default": True,
                },
            },
            "required": ["to", "subject", "body"],
        },
    },
]


def _get_creds():
    """Load and refresh Gmail OAuth credentials."""
    if not TOKEN_PATH.exists():
        raise RuntimeError(f"Token file not found: {TOKEN_PATH}")

    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json())
        else:
            raise RuntimeError("Gmail token expired and no refresh token available.")

    return creds


def _send_email(to, subject, body, is_html=True):
    """Send an email and return the message ID."""
    creds = _get_creds()

    msg = MIMEMultipart("alternative")
    msg["to"] = to
    msg["from"] = SENDER
    msg["subject"] = subject

    plain = "View this email in a browser that supports HTML."
    msg.attach(MIMEText(plain, "plain"))

    if is_html:
        msg.attach(MIMEText(body, "html"))
    else:
        # Replace the plain fallback with the actual text
        msg = MIMEMultipart("alternative")
        msg["to"] = to
        msg["from"] = SENDER
        msg["subject"] = subject
        msg.attach(MIMEText(body, "plain"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    sent = service.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()

    return sent.get("id", "unknown")


# --------------- JSON-RPC over stdio ---------------

def _respond(req_id, result):
    """Send a JSON-RPC success response."""
    resp = {"jsonrpc": "2.0", "id": req_id, "result": result}
    out = json.dumps(resp)
    sys.stdout.write(f"Content-Length: {len(out)}\r\n\r\n{out}")
    sys.stdout.flush()


def _error(req_id, code, message):
    """Send a JSON-RPC error response."""
    resp = {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}
    out = json.dumps(resp)
    sys.stdout.write(f"Content-Length: {len(out)}\r\n\r\n{out}")
    sys.stdout.flush()


def _notification(method, params=None):
    """Send a JSON-RPC notification (no id)."""
    msg = {"jsonrpc": "2.0", "method": method}
    if params:
        msg["params"] = params
    out = json.dumps(msg)
    sys.stdout.write(f"Content-Length: {len(out)}\r\n\r\n{out}")
    sys.stdout.flush()


def _read_message():
    """Read one JSON-RPC message from stdin (Content-Length framing)."""
    # Read headers
    content_length = None
    while True:
        line = sys.stdin.readline()
        if not line:
            return None  # EOF
        line = line.strip()
        if line == "":
            break
        if line.lower().startswith("content-length:"):
            content_length = int(line.split(":", 1)[1].strip())

    if content_length is None:
        return None

    body = sys.stdin.read(content_length)
    return json.loads(body)


def handle_request(msg):
    """Route a JSON-RPC request to the right handler."""
    method = msg.get("method", "")
    req_id = msg.get("id")
    params = msg.get("params", {})

    if method == "initialize":
        _respond(req_id, {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
        })

    elif method == "notifications/initialized":
        pass  # No response needed for notifications

    elif method == "tools/list":
        _respond(req_id, {"tools": TOOLS})

    elif method == "tools/call":
        tool_name = params.get("name", "")
        args = params.get("arguments", {})

        if tool_name == "send_email":
            try:
                msg_id = _send_email(
                    to=args["to"],
                    subject=args["subject"],
                    body=args["body"],
                    is_html=args.get("is_html", True),
                )
                _respond(req_id, {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Email sent to {args['to']}. Message ID: {msg_id}",
                        }
                    ],
                })
            except Exception as e:
                _respond(req_id, {
                    "content": [{"type": "text", "text": f"Error: {e}"}],
                    "isError": True,
                })
        else:
            _error(req_id, -32601, f"Unknown tool: {tool_name}")

    elif method == "ping":
        _respond(req_id, {})

    elif req_id is not None:
        _error(req_id, -32601, f"Method not found: {method}")


def main():
    """Run the MCP server loop."""
    while True:
        msg = _read_message()
        if msg is None:
            break
        handle_request(msg)


if __name__ == "__main__":
    main()
