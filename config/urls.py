import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
backend_path = str(BACKEND_DIR)
if backend_path in sys.path:
    sys.path.remove(backend_path)
sys.path.insert(0, backend_path)

from backend.config.urls import urlpatterns
