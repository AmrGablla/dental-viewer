import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


class UploadFile:
    def __init__(self, filename: str, file):
        self.filename = filename
        self.file = file


class BackgroundTasks:
    def add_task(self, func: Callable, *args, **kwargs):
        func(*args, **kwargs)


def File(*args, **kwargs):  # pragma: no cover
    return None


@dataclass
class Route:
    method: str
    path: str
    func: Callable


class APIRouter:
    def __init__(self, prefix: str = ""):
        self.routes: List[Route] = []
        self.prefix = prefix

    def get(self, path: str):
        def decorator(func: Callable):
            self.routes.append(Route("GET", self.prefix + path, func))
            return func

        return decorator

    def post(self, path: str):
        def decorator(func: Callable):
            self.routes.append(Route("POST", self.prefix + path, func))
            return func

        return decorator


class FastAPI(APIRouter):
    def __init__(self, title: str = ""):
        super().__init__(prefix="")
        self.title = title

    def add_middleware(self, *args, **kwargs):  # pragma: no cover
        pass

    def include_router(self, router: APIRouter):
        self.routes.extend(router.routes)


class StreamingResponse:
    def __init__(self, content, media_type: str | None = None, headers: Dict[str, str] | None = None):
        if hasattr(content, "read"):
            self.content = content.read()
        else:
            self.content = content
        self.media_type = media_type
        self.headers = headers or {}
