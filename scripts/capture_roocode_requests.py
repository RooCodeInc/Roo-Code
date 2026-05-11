#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import http.client
import json
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

HOP_BY_HOP_HEADERS = {
	"connection",
	"proxy-connection",
	"keep-alive",
	"transfer-encoding",
	"te",
	"trailer",
	"upgrade",
}


def utc_now() -> str:
	return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_path(path: str) -> str:
	if not path.startswith("/"):
		return "/" + path
	return path


def join_paths(base_path: str, suffix_path: str) -> str:
	base_path = normalize_path(base_path or "/")
	suffix_path = normalize_path(suffix_path or "/")

	if base_path != "/" and base_path.endswith("/"):
		base_path = base_path[:-1]
	if suffix_path == "/":
		return base_path
	if base_path == "/":
		return suffix_path
	return base_path + suffix_path


def is_textual_content(content_type: Optional[str]) -> bool:
	if not content_type:
		return False
	ct = content_type.lower()
	return any(
		marker in ct
		for marker in (
			"application/json",
			"text/",
			"application/xml",
			"application/x-www-form-urlencoded",
			"application/javascript",
			"application/graphql",
			"text/event-stream",
		)
	)


def format_body(body: bytes, content_type: Optional[str]) -> str:
	if not body:
		return "<empty>"

	if is_textual_content(content_type):
		try:
			text = body.decode("utf-8")
		except UnicodeDecodeError:
			text = None

		if text is not None:
			if content_type and "json" in content_type.lower():
				try:
					return json.dumps(json.loads(text), indent=2, ensure_ascii=False)
				except json.JSONDecodeError:
					return text
			return text

	return (
		f"<binary {len(body)} bytes>\n"
		f"base64:\n{base64.b64encode(body).decode('ascii')}"
	)


class RequestLogger:
	def __init__(self, log_file: Path):
		self.log_file = log_file
		self.lock = threading.Lock()
		self.counter = 0
		self.log_file.parent.mkdir(parents=True, exist_ok=True)

	def write(self, entry: str) -> None:
		with self.lock:
			with self.log_file.open("a", encoding="utf-8") as fp:
				fp.write(entry)
				if not entry.endswith("\n"):
					fp.write("\n")
				fp.flush()

	def next_id(self) -> int:
		with self.lock:
			self.counter += 1
			return self.counter


class ProxyHandler(BaseHTTPRequestHandler):
	protocol_version = "HTTP/1.1"

	upstream_scheme = "https"
	upstream_host = "api.openai.com"
	upstream_port = 443
	upstream_base_path = "/v1"
	local_prefix = "/v1"
	logger: RequestLogger

	def log_message(self, format: str, *args) -> None:  # noqa: A003
		return

	def do_GET(self) -> None:  # noqa: N802
		self._handle()

	def do_POST(self) -> None:  # noqa: N802
		self._handle()

	def do_PUT(self) -> None:  # noqa: N802
		self._handle()

	def do_PATCH(self) -> None:  # noqa: N802
		self._handle()

	def do_DELETE(self) -> None:  # noqa: N802
		self._handle()

	def do_OPTIONS(self) -> None:  # noqa: N802
		self._handle()

	def _read_body(self) -> bytes:
		transfer_encoding = (self.headers.get("Transfer-Encoding") or "").lower()
		if "chunked" in transfer_encoding:
			chunks: list[bytes] = []
			while True:
				line = self.rfile.readline().strip()
				if not line:
					continue
				size = int(line.split(b";", 1)[0], 16)
				if size == 0:
					while True:
						trailer = self.rfile.readline()
						if trailer in (b"\r\n", b"\n", b""):
							break
					break
				chunks.append(self.rfile.read(size))
				self.rfile.read(2)  # trailing CRLF
			return b"".join(chunks)

		content_length = self.headers.get("Content-Length")
		if not content_length:
			return b""

		try:
			length = int(content_length)
		except ValueError:
			return b""

		return self.rfile.read(length)

	def _target_path(self) -> str:
		parsed = urlsplit(self.path)
		incoming_path = normalize_path(parsed.path or "/")

		prefix = self.local_prefix or ""
		if prefix and incoming_path.startswith(prefix):
			remaining = incoming_path[len(prefix) :]
			if not remaining:
				remaining = "/"
		else:
			remaining = incoming_path

		forward_path = join_paths(self.upstream_base_path, remaining)
		if parsed.query:
			forward_path += f"?{parsed.query}"
		return forward_path

	def _forward_headers(self) -> dict[str, str]:
		headers: dict[str, str] = {}
		for key, value in self.headers.items():
			if key.lower() in HOP_BY_HOP_HEADERS:
				continue
			headers[key] = value

		headers["Host"] = (
			self.upstream_host
			if self.upstream_port in (80, 443)
			else f"{self.upstream_host}:{self.upstream_port}"
		)
		headers["Accept-Encoding"] = "identity"
		headers.pop("Content-Length", None)
		return headers

	def _send_chunk(self, data: bytes) -> None:
		if not data:
			return
		self.wfile.write(f"{len(data):X}\r\n".encode("ascii"))
		self.wfile.write(data)
		self.wfile.write(b"\r\n")

	def _handle(self) -> None:
		request_id = self.logger.next_id()
		body = self._read_body()
		parsed = urlsplit(self.path)
		forward_path = self._target_path()
		forward_headers = self._forward_headers()

		request_header_lines = "\n".join(f"  {k}: {v}" for k, v in self.headers.items()) or "  <none>"
		body_text = format_body(body, self.headers.get("Content-Type"))

		log_entry = (
			"=" * 80
			+ f"\nREQUEST #{request_id}\n"
			+ f"Time: {utc_now()}\n"
			+ f"Client: {self.client_address[0]}:{self.client_address[1]}\n"
			+ f"Method: {self.command}\n"
			+ f"Incoming path: {self.path}\n"
			+ f"Forward to: {self.upstream_scheme}://{self.upstream_host}:{self.upstream_port}{forward_path}\n"
			+ "\nHeaders:\n"
			+ f"{request_header_lines}\n"
			+ "\nBody:\n"
			+ f"{body_text}\n"
			+ "\n"
		)
		self.logger.write(log_entry)

		conn_cls = http.client.HTTPSConnection if self.upstream_scheme == "https" else http.client.HTTPConnection
		conn = conn_cls(self.upstream_host, self.upstream_port, timeout=120)

		try:
			conn.request(self.command, forward_path, body=body if body else None, headers=forward_headers)
			resp = conn.getresponse()

			self.send_response(resp.status, resp.reason)
			for name, value in resp.getheaders():
				lower = name.lower()
				if lower in HOP_BY_HOP_HEADERS or lower == "content-length":
					continue
				self.send_header(name, value)

			# Use chunked transfer so SSE / streaming responses stay live.
			self.send_header("Transfer-Encoding", "chunked")
			self.end_headers()

			while True:
				chunk = resp.read(8192)
				if not chunk:
					break
				self._send_chunk(chunk)
				self.wfile.flush()

			self.wfile.write(b"0\r\n\r\n")
			self.wfile.flush()
			resp.close()
		finally:
			conn.close()


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Capture RooCode requests and write request headers/body to log.txt",
	)
	parser.add_argument(
		"--listen-host",
		default="127.0.0.1",
		help="Proxy listen host (default: 127.0.0.1)",
	)
	parser.add_argument(
		"--listen-port",
		type=int,
		default=8000,
		help="Proxy listen port (default: 8000)",
	)
	parser.add_argument(
		"--upstream",
		default="https://api.openai.com/v1",
		help="Upstream base URL (default: https://api.openai.com/v1)",
	)
	parser.add_argument(
		"--local-prefix",
		default="/v1",
		help="Path prefix RooCode will send to this proxy (default: /v1)",
	)
	parser.add_argument(
		"--log-file",
		default="log.txt",
		help="Log file path (default: log.txt)",
	)
	return parser.parse_args()


def main() -> int:
	args = parse_args()
	parsed = urlsplit(args.upstream)
	if parsed.scheme not in {"http", "https"}:
		raise SystemExit("--upstream must start with http:// or https://")
	if not parsed.hostname:
		raise SystemExit("--upstream must include a host")

	ProxyHandler.upstream_scheme = parsed.scheme
	ProxyHandler.upstream_host = parsed.hostname
	ProxyHandler.upstream_port = parsed.port or (443 if parsed.scheme == "https" else 80)
	ProxyHandler.upstream_base_path = parsed.path or "/"
	ProxyHandler.local_prefix = normalize_path(args.local_prefix)
	ProxyHandler.logger = RequestLogger(Path(args.log_file).resolve())

	server = ThreadingHTTPServer((args.listen_host, args.listen_port), ProxyHandler)
	print(f"Proxy listening on http://{args.listen_host}:{args.listen_port}{ProxyHandler.local_prefix}")
	print(f"Forwarding to {args.upstream}")
	print(f"Logging to {Path(args.log_file).resolve()}")
	print("Set RooCode base URL to http://127.0.0.1:<port>/v1 and keep your real API key in RooCode.")
	try:
		server.serve_forever()
	except KeyboardInterrupt:
		print("\nStopped.")
		return 0
	finally:
		server.server_close()
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
