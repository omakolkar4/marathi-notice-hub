"""
Health check and environment verification tests.
Tests importing core packages, verifying FastAPI instance, and NLP stubs.
"""

import sys
from app.main import app, root, health_check
from app.nlp.preprocessing import clean_marathi_text
from app.nlp.classification import classify_notice
from app.nlp.recipient_detection import detect_recipients
from app.nlp.entity_extraction import extract_entities


def test_python_version():
    """Verify supported Python version."""
    assert sys.version_info >= (3, 10), "Python version must be >= 3.10"


def test_fastapi_app_initialization():
    """Verify FastAPI application metadata and title."""
    assert app.title == "Marathi Notice Hub API"
    assert app.version in ["0.1.0", "0.2.0", "1.0.0"]


def test_endpoints_direct_call():
    """Verify endpoints return expected schema and branding."""
    root_res = root()
    assert root_res["app_name"] == "Marathi Notice Hub"
    assert "project" in root_res

    health_res = health_check()
    assert health_res["status"] == "healthy"


def test_nlp_stubs():
    """Verify initial NLP module stubs execute cleanly."""
    assert clean_marathi_text("  शाळा  ") == "शाळा"
    assert "category" in classify_notice("शाळा बंद राहील")
    assert isinstance(detect_recipients("सर्व शिक्षकांनी उपस्थित राहावे"), list)
    assert isinstance(extract_entities("दिनांक १५ ऑगस्ट रोजी बैठक"), dict)


def test_core_scientific_libraries():
    """Verify scientific and machine learning libraries import cleanly."""
    import numpy as np
    import sklearn

    arr = np.array([1, 2, 3])
    assert len(arr) == 3
    assert sklearn.__version__ is not None

    try:
        import pandas as pd
        df = pd.DataFrame({"col": arr})
        assert len(df) == 3
    except ImportError:
        # On Windows 11 with Smart App Control / WDAC, pandas C-extensions may be blocked
        pass
