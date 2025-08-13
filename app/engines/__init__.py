from .ml import MLSeg, ModelNotAvailable
from .simple import SimpleSeg


def get_engine(name: str):
    if name == "ml":
        return MLSeg()
    return SimpleSeg()
