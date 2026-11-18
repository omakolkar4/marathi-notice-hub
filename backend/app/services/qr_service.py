"""
QR Token and SVG Generation Service
Academic Project: Marathi NLP-Based Intelligent Notice Management System
Application: Marathi Notice Hub
Phase 6: QR-Based Examination Management and Faculty Punctuality Tracking
"""

import secrets
from urllib.parse import quote
from datetime import datetime, timedelta
from typing import Tuple
import qrcode
import qrcode.image.svg


class QRService:
    """Handles secure token generation, validation, and vector SVG QR rendering."""

    @staticmethod
    def generate_secure_token(prefix: str = "EXAM") -> str:
        """Generates an unguessable 48-character cryptographic URL-safe token."""
        random_part = secrets.token_urlsafe(32)
        return f"{prefix}_{random_part}"

    @staticmethod
    def generate_qr_svg(payload: str) -> str:
        """
        Generates scalable vector SVG code for the given payload string.
        SVG renders sharply across high-resolution displays and physical printouts.
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
            image_factory=qrcode.image.svg.SvgPathImage
        )
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image()
        svg_bytes = img.to_string()
        if isinstance(svg_bytes, bytes):
            return svg_bytes.decode("utf-8")
        return str(svg_bytes)

    @staticmethod
    def compute_default_validity_window(exam_date_str: str, reporting_time_str: str) -> Tuple[datetime, datetime]:
        """
        Computes the active validity window for an exam's QR code.
        Default window: 2 hours before reporting time until 3 hours after reporting time.
        """
        try:
            exam_datetime = datetime.strptime(f"{exam_date_str.strip()} {reporting_time_str.strip()}", "%Y-%m-%d %H:%M")
        except Exception:
            exam_datetime = datetime.utcnow()

        valid_from = exam_datetime - timedelta(hours=2)
        valid_until = exam_datetime + timedelta(hours=3)
        return valid_from, valid_until


qr_service = QRService()
