"""Reverse proxy port 8001 -> localhost:3000 (Next.js dev server).

The platform ingress routes /api/* to port 8001. This Next.js app serves
its own /api/* routes from the same Next.js server on port 3000, so we
forward all traffic to localhost:3000.
"""
import httpx
from fastapi import FastAPI, Request, Response

UPSTREAM = "http://localhost:3000"

app = FastAPI()
client = httpx.AsyncClient(base_url=UPSTREAM, timeout=60.0, follow_redirects=False)

HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
}


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy(full_path: str, request: Request):
    url = f"/{full_path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    headers = [
        (k, v)
        for k, v in request.headers.raw
        if k.decode().lower() not in {"host", "content-length"}
    ]
    body = await request.body()

    try:
        upstream = await client.request(
            request.method,
            url,
            headers=[(k.decode(), v.decode()) for k, v in headers],
            content=body,
        )
    except httpx.ConnectError:
        return Response("Upstream is starting…", status_code=503)

    # Build response headers preserving multi-value (esp. Set-Cookie)
    raw_headers: list[tuple[bytes, bytes]] = []
    for key, value in upstream.headers.multi_items():
        if key.lower() in HOP_BY_HOP:
            continue
        raw_headers.append((key.encode("latin-1"), value.encode("latin-1")))

    resp = Response(content=upstream.content, status_code=upstream.status_code)
    resp.raw_headers = raw_headers
    return resp
