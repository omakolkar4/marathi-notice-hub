"""
Notice Classification Module
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub

Implements baseline machine-learning text classification using Scikit-Learn,
TF-IDF feature extraction, and Logistic Regression across 8 institutional notice categories.
"""

import json
import logging
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report, accuracy_score, f1_score
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline

from app.nlp.preprocessing import clean_marathi_text, tokenize_marathi

logger = logging.getLogger(__name__)

# Supported notice categories
CATEGORIES: List[str] = [
    "Examination",
    "Meeting",
    "Holiday",
    "Academic",
    "Event",
    "Administrative",
    "Emergency",
    "General",
]

DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
DEFAULT_MODEL_PATH = DEFAULT_ARTIFACT_DIR / "notice_classifier.joblib"
DEFAULT_METADATA_PATH = DEFAULT_ARTIFACT_DIR / "classifier_metadata.json"

# In-memory cached model instance
_CACHED_MODEL: Optional[Pipeline] = None


def get_pipeline() -> Pipeline:
    """Constructs the Scikit-learn TF-IDF + Multinomial Naive Bayes pipeline."""
    return Pipeline([
        ('tfidf', TfidfVectorizer(
            tokenizer=tokenize_marathi,
            token_pattern=None,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
            lowercase=False
        )),
        ('clf', MultinomialNB(alpha=0.5))
    ])


def train_classifier(
    dataset_path: Path,
    artifact_path: Path = DEFAULT_MODEL_PATH,
    metadata_path: Path = DEFAULT_METADATA_PATH,
    test_size: float = 0.25,
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Trains the notice classifier from a labeled JSON dataset, evaluates on a stratified holdout
    and 4-fold cross-validation, and saves the trained model artifact.
    """
    dataset_path = Path(dataset_path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at: {dataset_path}")

    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not data or not isinstance(data, list):
        raise ValueError("Dataset JSON must contain a list of records.")
    if "text" not in data[0] or "category" not in data[0]:
        raise ValueError("Dataset JSON must contain 'text' and 'category' fields.")

    cleaned_texts = [clean_marathi_text(item["text"]) for item in data]
    categories = [item["category"] for item in data]

    X = np.array(cleaned_texts)
    y = np.array(categories)

    total_samples = len(data)
    category_counts = dict(Counter(categories))

    # Stratified Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=test_size,
        random_state=random_state,
        stratify=y
    )

    pipeline = get_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    test_acc = float(accuracy_score(y_test, y_pred))
    test_f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

    # Stratified K-Fold Cross Validation across the entire dataset
    cv = StratifiedKFold(n_splits=4, shuffle=True, random_state=random_state)
    cv_scores = cross_val_score(get_pipeline(), X, y, cv=cv, scoring='accuracy')

    # Retrain on 100% of the sample prototype data for operational artifact
    final_pipeline = get_pipeline()
    final_pipeline.fit(X, y)

    # Ensure artifact directory exists
    artifact_path.parent.mkdir(parents=True, exist_ok=True)

    # Save model artifact
    joblib.dump(final_pipeline, artifact_path)

    report_dict = classification_report(
        y_test, y_pred,
        labels=CATEGORIES,
        output_dict=True,
        zero_division=0
    )

    metadata: Dict[str, Any] = {
        "model_architecture": "TF-IDF (1-2 ngrams) + Multinomial Naive Bayes",
        "dataset_name": dataset_path.name,
        "dataset_type": "Synthetic Marathi School Notices (Prototype Dataset)",
        "total_samples": total_samples,
        "categories": CATEGORIES,
        "category_distribution": category_counts,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "holdout_test_accuracy": round(test_acc, 4),
        "holdout_test_f1_weighted": round(test_f1, 4),
        "cross_val_accuracy_mean": round(float(np.mean(cv_scores)), 4),
        "cross_val_accuracy_std": round(float(np.std(cv_scores)), 4),
        "classification_report": report_dict,
        "disclaimer": "Metrics are computed on a small synthetic prototype dataset for development. Accuracy will vary on real-world noisy school circulars."
    }

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    global _CACHED_MODEL
    _CACHED_MODEL = final_pipeline

    return metadata


def load_classifier(artifact_path: Path = DEFAULT_MODEL_PATH) -> Optional[Pipeline]:
    """Loads and caches the trained classification pipeline."""
    global _CACHED_MODEL
    if _CACHED_MODEL is not None:
        return _CACHED_MODEL

    artifact_path = Path(artifact_path)
    if not artifact_path.exists():
        logger.warning(f"Classifier model artifact not found at {artifact_path}")
        return None

    try:
        _CACHED_MODEL = joblib.load(artifact_path)
        return _CACHED_MODEL
    except Exception as e:
        logger.error(f"Failed to load classifier model: {e}")
        return None


def classify_notice(
    text: str,
    artifact_path: Path = DEFAULT_MODEL_PATH
) -> Dict[str, Any]:
    """
    Classifies a Marathi notice into one of 8 categories.
    Returns predicted category, confidence score, all class probabilities, and status.
    """
    cleaned = clean_marathi_text(text)
    if not cleaned or len(cleaned.strip()) < 3:
        return {
            "category": "General",
            "confidence": 0.0,
            "probabilities": {cat: 0.0 for cat in CATEGORIES},
            "model_type": "None (Empty / Invalid Input Fallback)",
            "is_fallback": True
        }

    pipeline = load_classifier(artifact_path)
    if pipeline is None:
        return {
            "category": "General",
            "confidence": 0.0,
            "probabilities": {cat: 0.0 for cat in CATEGORIES},
            "model_type": "None (Model Not Trained/Loaded)",
            "is_fallback": True
        }

    try:
        # Predict class
        pred_label = pipeline.predict([cleaned])[0]

        # Predict probabilities
        probs = pipeline.predict_proba([cleaned])[0]
        classes = pipeline.classes_

        prob_dict = {
            cls_name: round(float(prob), 4)
            for cls_name, prob in zip(classes, probs)
        }
        confidence = prob_dict.get(pred_label, 0.0)

        return {
            "category": pred_label,
            "confidence": confidence,
            "probabilities": prob_dict,
            "model_type": "TF-IDF + MultinomialNB",
            "is_fallback": False
        }
    except Exception as e:
        logger.error(f"Classification inference error: {e}")
        return {
            "category": "General",
            "confidence": 0.0,
            "probabilities": {cat: 0.0 for cat in CATEGORIES},
            "model_type": f"Error: {str(e)}",
            "is_fallback": True
        }
