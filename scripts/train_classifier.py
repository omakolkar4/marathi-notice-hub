"""
Training Script for Marathi Notice Classification
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.nlp.classification import train_classifier, DEFAULT_MODEL_PATH, DEFAULT_METADATA_PATH


def main():
    dataset_path = PROJECT_ROOT / "data" / "sample" / "notice_classification_dataset.json"
    print("=" * 65)
    print("Marathi Notice Hub - ML Classifier Training")
    print("=" * 65)
    print(f"Dataset:  {dataset_path}")
    print(f"Artifact: {DEFAULT_MODEL_PATH}")
    print(f"Metadata: {DEFAULT_METADATA_PATH}\n")

    try:
        metrics = train_classifier(
            dataset_path=dataset_path,
            artifact_path=DEFAULT_MODEL_PATH,
            metadata_path=DEFAULT_METADATA_PATH,
            test_size=0.25,
            random_state=42
        )

        print("[SUCCESS] Model trained and saved successfully!\n")
        print("--- Training & Evaluation Summary ---")
        print(f"  Architecture:           {metrics['model_architecture']}")
        print(f"  Total Samples:          {metrics['total_samples']}")
        print(f"  Training Split:         {metrics['train_samples']} samples")
        print(f"  Holdout Test Split:     {metrics['test_samples']} samples")
        print(f"  Holdout Test Accuracy:  {metrics['holdout_test_accuracy'] * 100:.2f}%")
        print(f"  Holdout Weighted F1:    {metrics['holdout_test_f1_weighted'] * 100:.2f}%")
        print(f"  4-Fold CV Accuracy:     {metrics['cross_val_accuracy_mean'] * 100:.2f}% (+/- {metrics['cross_val_accuracy_std'] * 100:.2f}%)")
        print(f"\n  Categories Evaluated:   {', '.join(metrics['categories'])}")
        print("\n--- Per-Class Performance (Holdout Set) ---")
        for cat in metrics['categories']:
            stats = metrics['classification_report'].get(cat, {})
            p = stats.get('precision', 0.0)
            r = stats.get('recall', 0.0)
            f = stats.get('f1-score', 0.0)
            s = stats.get('support', 0)
            print(f"  {cat:<16} | Prec: {p:.2f} | Rec: {r:.2f} | F1: {f:.2f} | Support: {s}")

        print("\n" + "=" * 65)
        print(f"[NOTE] {metrics['disclaimer']}")
        print("=" * 65)

    except Exception as e:
        print(f"[ERROR] Training failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
