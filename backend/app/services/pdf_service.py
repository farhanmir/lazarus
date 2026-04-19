"""HTML to PDF rendering for executive blueprints."""

from __future__ import annotations

from pathlib import Path


def _render_with_weasyprint(html: str, output_path: Path, css_path: Path | None = None) -> bool:
    try:
        from weasyprint import CSS, HTML
    except Exception:
        return False

    stylesheets = [CSS(filename=str(css_path))] if css_path and css_path.exists() else None
    base_url = str(css_path.parent) if css_path and css_path.exists() else str(output_path.parent)
    HTML(string=html, base_url=base_url).write_pdf(
        str(output_path),
        stylesheets=stylesheets,
    )
    return True


def render_pdf_from_html(html: str, output_path: Path, css_path: Path | None = None) -> Path:
    """Convert HTML to PDF using WeasyPrint only.

    The prior ReportLab fallback flattened styled HTML into plain text, which
    produced artifacts that did not match the product's blueprint format.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    success = _render_with_weasyprint(html, output_path, css_path)
    if not success:
        raise RuntimeError("WeasyPrint is unavailable; cannot generate a formatted blueprint PDF.")
    return output_path
