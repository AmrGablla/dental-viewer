import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Dict

from .simple import APIRouter, BackgroundTasks, FastAPI, HTTPException, UploadFile, Route, StreamingResponse


@dataclass
class Response:
    status_code: int
    data: Any
    headers: Dict[str, str] | None = None

    @property
    def content(self) -> bytes:
        if isinstance(self.data, (bytes, bytearray)):
            return bytes(self.data)
        if isinstance(self.data, StreamingResponse):
            return self.data.content
        return json.dumps(self.data).encode()

    def json(self):
        if isinstance(self.data, StreamingResponse):
            return json.loads(self.data.content.decode())
        return self.data


class TestClient:
    def __init__(self, app: FastAPI):
        self.app = app

    def _find_route(self, method: str, path: str) -> Route | None:
        for r in self.app.routes:
            pattern = "^" + re.sub(r"{[^/]+}", r"([^/]+)", r.path) + "$"
            if r.method == method and re.match(pattern, path):
                return r
        return None

    def _call(self, func, **kwargs):
        if asyncio.iscoroutinefunction(func):
            return asyncio.run(func(**kwargs))
        return func(**kwargs)

    def post(self, path: str, files=None):
        route = self._find_route("POST", path.split("?")[0])
        assert route, "route not found"
        query = {}
        if "?" in path:
            q = path.split("?")[1]
            for part in q.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    query[k] = v
        background = BackgroundTasks()
        upload = None
        if files:
            _, (filename, file, _content_type) = next(iter(files.items()))
            upload = UploadFile(filename, file)
        data = self._call(route.func, background=background, file=upload, engine=None, scheme="universal", sync=int(query.get("sync", 0)))
        return Response(200, data)

    def get(self, path: str):
        route = self._find_route("GET", path.split("?")[0])
        assert route, "route not found"
        params = {}
        match = re.match("^" + re.sub(r"{([^/]+)}", r"(?P<\1>[^/]+)", route.path) + "$", path.split("?")[0])
        if match:
            params = match.groupdict()
        data = self._call(route.func, **params)
        return Response(200, data)
