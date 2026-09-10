import json
import logging
import time
from collections import OrderedDict, deque
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import config


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps(
            {
                "level": record.levelname,
                "module": record.name,
                "event": record.getMessage(),
                **{
                    k: getattr(record, k) for k in ("invoice_id", "operation", "status") if hasattr(record, k)
                },
            }
        )


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.getLogger("nfe").addHandler(handler)
logging.getLogger("nfe").setLevel(logging.INFO)
app = FastAPI(
    title="NF-e Lab API",
    version="1.0.0",
    description="Gerador de homologação. XML não assinado; validação XSD do conteúdo infNFe, sem transmissão SEFAZ.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins.split(","),
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(router)
requests_by_ip = OrderedDict()


@app.middleware("http")
async def request_guard(request: Request, call_next):
    # Replace by a shared gateway limiter before deploying multiple workers.
    ip = request.client.host if request.client else "local"
    clock = time.monotonic()
    bucket = requests_by_ip.setdefault(ip, deque())
    requests_by_ip.move_to_end(ip)
    while len(requests_by_ip) > 10000:
        requests_by_ip.popitem(last=False)
    while bucket and bucket[0] < clock - 60:
        bucket.popleft()
    if len(bucket) >= config.requests_per_minute:
        return JSONResponse(
            status_code=429,
            content={"detail": "Muitas requisições. Aguarde um minuto."},
            headers={"Retry-After": "60"},
        )
    bucket.append(clock)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 2_000_000:
            return JSONResponse(status_code=413, content={"detail": "Limite de requisição: 2 MB."})
    request._body = bytes(body)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Request-ID"] = str(uuid4())
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "path": ".".join(str(p) for p in e["loc"] if p != "body"),
                    "message": e["msg"],
                    "severity": "error",
                }
                for e in exc.errors()
            ]
        },
    )


@app.exception_handler(Exception)
async def internal_error(request, exc):
    logging.getLogger("nfe.api").error(
        "internal_error", extra={"operation": request.method, "status": type(exc).__name__}
    )
    return JSONResponse(
        status_code=500, content={"detail": "Não foi possível concluir a operação. Tente novamente."}
    )
