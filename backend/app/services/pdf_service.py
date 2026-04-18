"""HTML to PDF rendering for executive blueprints."""

from __future__ import annotations

import re
from html import unescape
from pathlib import Path


def _render_with_weasyprint(html: str, output_path: Path, css_path: Path | None = None) -> bool:
    try:
        from weasyprint import CSS, HTML
    except Exception:
        return False

    stylesheets = [CSS(filename=str(css_path))] if css_path and css_path.exists() else None
    HTML(string=html, base_url=str(output_path.parent)).write_pdf(
        str(output_path),
        stylesheets=stylesheets,
    )
    return True


def _strip_html(html: str) -> list[str]:
    text = re.sub(r"<style.*?>.*?</style>", "", html, flags=re.DOTALL)
    text = re.sub(r"<script.*?>.*?</script>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = unescape(text)
    lines = [line.strip() for line in text.splitlines()]
    return [line for line in lines if line]


def _render_with_reportlab(html: str, output_path: Path) -> None:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    pdf = canvas.Canvas(str(output_path), pagesize=LETTER)
    width, height = LETTER
    x = 56
    y = height - 56
    for line in _strip_html(html):
        if y <= 56:
            pdf.showPage()
            y = height - 56
        pdf.drawString(x, y, line[:105])
        y -= 16
    pdf.save()


def render_pdf_from_html(html: str, output_path: Path, css_path: Path | None = None) -> Path:
    """Convert HTML to PDF using WeasyPrint, falling back to ReportLab."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    success = _render_with_weasyprint(html, output_path, css_path)
    if not success:
        _render_with_reportlab(html, output_path)
    return output_path
