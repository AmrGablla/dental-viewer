from pathlib import Path


def load_mesh(path: Path) -> bytes:
    return path.read_bytes()
