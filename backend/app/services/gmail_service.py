"""Gmail notification delivery service for Lazarus alerts."""

from __future__ import annotations

import logging
import os
import smtplib
from datetime import datetime, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _get_gmail_config() -> tuple[str, str, str] | None:
    """Return (sender_email, app_password, recipient_email) or None if not configured."""
    sender = os.getenv("GMAIL_SENDER", "").strip()
    app_password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
    recipient = os.getenv("GMAIL_RECIPIENT", "").strip()
    if not sender or not app_password or not recipient:
        return None
    return sender, app_password, recipient


def _send_email(
    *,
    subject: str,
    html_body: str,
    text_body: str,
    recipient_override: str | None = None,
    attachments: list[Path] | None = None,
) -> dict[str, Any]:
    """Send an email via Gmail SMTP."""
    config = _get_gmail_config()
    if config is None:
        return {
            "ok": False,
            "status": "skipped",
            "reason": "Gmail configuration is incomplete. Set GMAIL_SENDER, GMAIL_APP_PASSWORD, and GMAIL_RECIPIENT.",
        }

    sender, app_password, default_recipient = config
    recipient = recipient_override or default_recipient

    msg = MIMEMultipart("mixed")
    msg["From"] = f"Lazarus Alerts <{sender}>"
    msg["To"] = recipient
    msg["Subject"] = subject

    alt_part = MIMEMultipart("alternative")
    alt_part.attach(MIMEText(text_body, "plain"))
    alt_part.attach(MIMEText(html_body, "html"))
    msg.attach(alt_part)

    for attachment_path in attachments or []:
        if attachment_path.exists():
            with open(attachment_path, "rb") as f:
                part = MIMEApplication(f.read(), Name=attachment_path.name)
            part["Content-Disposition"] = f'attachment; filename="{attachment_path.name}"'
            msg.attach(part)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(sender, app_password)
            server.sendmail(sender, [recipient], msg.as_string())

        return {
            "ok": True,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
    except smtplib.SMTPAuthenticationError:
        logger.exception("[gmail] authentication failed — check GMAIL_APP_PASSWORD")
        return {"ok": False, "status": "failed", "reason": "Gmail authentication failed. Use an App Password, not your account password."}
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception("[gmail] send failed")
        return {"ok": False, "status": "failed", "reason": str(exc)}


def send_gmail_watchlist_alert(
    *,
    drug_name: str,
    asset_code: str,
    original_indication: str,
    matched_disease: str,
    confidence: float,
    risk_level: str,
    reason: str,
) -> dict[str, Any]:
    """Send a formatted watchlist alert email."""
    confidence_pct = round(confidence * 100) if confidence <= 1 else round(confidence)
    risk_color = {"low": "#22c55e", "medium": "#eab308", "high": "#ef4444"}.get(risk_level.lower(), "#6b7280")
    risk_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴"}.get(risk_level.lower(), "⚪")

    subject = f"🔔 Lazarus Alert: {drug_name} ({asset_code}) → {matched_disease} ({confidence_pct}%)"

    text_body = (
        f"LAZARUS WATCHLIST ALERT\n"
        f"{'=' * 40}\n\n"
        f"Drug: {drug_name} ({asset_code})\n"
        f"Original Indication: {original_indication}\n"
        f"Matched Disease: {matched_disease}\n"
        f"Confidence: {confidence_pct}%\n"
        f"Risk Level: {risk_emoji} {risk_level.capitalize()}\n\n"
        f"Summary:\n{reason}\n\n"
        f"Open the Lazarus dashboard to review this finding."
    )

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 20px; color: white;">🔔 Lazarus Watchlist Alert</h1>
      </div>
      <div style="padding: 32px;">
        <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #c4b5fd;">
            💊 {drug_name} <span style="color: #94a3b8; font-weight: normal;">({asset_code})</span>
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; width: 160px;">Original Indication</td>
              <td style="padding: 8px 0; color: #e2e8f0; font-weight: 600;">{original_indication}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Matched Disease</td>
              <td style="padding: 8px 0; color: #a78bfa; font-weight: 600;">🎯 {matched_disease}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Confidence</td>
              <td style="padding: 8px 0;">
                <span style="background: #6366f1; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 14px;">{confidence_pct}%</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Risk Level</td>
              <td style="padding: 8px 0;">
                <span style="background: {risk_color}22; color: {risk_color}; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 14px; border: 1px solid {risk_color}44;">{risk_emoji} {risk_level.capitalize()}</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 3px solid #6366f1;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Analysis Summary</h3>
          <p style="margin: 0; color: #e2e8f0; line-height: 1.6;">{reason}</p>
        </div>
        <div style="text-align: center; padding-top: 8px;">
          <p style="color: #64748b; font-size: 13px; margin: 0;">Open the Lazarus dashboard to review this finding</p>
        </div>
      </div>
      <div style="background: #1e293b; padding: 16px 32px; text-align: center;">
        <p style="margin: 0; color: #475569; font-size: 12px;">Lazarus Drug Repurposing Platform • Automated Alert</p>
      </div>
    </div>
    """

    return _send_email(subject=subject, html_body=html_body, text_body=text_body)


def send_gmail_scan_summary(
    *,
    disease_query: str,
    total_assets: int,
    alert_count: int,
    cache_hits: int,
) -> dict[str, Any]:
    """Send a watchlist scan completion summary email."""
    status_icon = "✅" if alert_count > 0 else "❌"
    subject = f"📋 Lazarus Scan Complete: {disease_query} — {alert_count} match{'es' if alert_count != 1 else ''}"

    text_body = (
        f"LAZARUS WATCHLIST SCAN COMPLETE\n"
        f"{'=' * 40}\n\n"
        f"Disease Query: {disease_query}\n"
        f"Assets Scanned: {total_assets}\n"
        f"Cached Results: {cache_hits}/{total_assets}\n"
        f"Matches Found: {alert_count}\n\n"
        f"Check the Lazarus dashboard for details."
    )

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 20px; color: white;">📋 Watchlist Scan Complete</h1>
      </div>
      <div style="padding: 32px;">
        <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #94a3b8; width: 160px;">🔍 Disease Query</td>
              <td style="padding: 10px 0; color: #e2e8f0; font-weight: 600;">{disease_query}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #94a3b8;">💊 Assets Scanned</td>
              <td style="padding: 10px 0; color: #e2e8f0; font-weight: 600;">{total_assets}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #94a3b8;">⚡ Cached Results</td>
              <td style="padding: 10px 0; color: #e2e8f0; font-weight: 600;">{cache_hits}/{total_assets}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #94a3b8;">🎯 Matches</td>
              <td style="padding: 10px 0;">
                <span style="background: {'#22c55e' if alert_count > 0 else '#ef4444'}22; color: {'#22c55e' if alert_count > 0 else '#ef4444'}; padding: 4px 14px; border-radius: 12px; font-weight: 700; font-size: 15px;">{status_icon} {alert_count}</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="text-align: center; padding-top: 8px;">
          <p style="color: #64748b; font-size: 13px; margin: 0;">Check individual alerts for detailed analysis</p>
        </div>
      </div>
      <div style="background: #1e293b; padding: 16px 32px; text-align: center;">
        <p style="margin: 0; color: #475569; font-size: 12px;">Lazarus Drug Repurposing Platform • Automated Scan Report</p>
      </div>
    </div>
    """

    return _send_email(subject=subject, html_body=html_body, text_body=text_body)


def send_blueprint_email(
    *,
    recipient_email: str,
    drug_name: str,
    asset_code: str,
    proposed_indication: str,
    confidence_score: float,
    recommendation: str,
    pdf_path: str,
) -> dict[str, Any]:
    """Send the executive blueprint PDF to a custom recipient."""
    conf_pct = round(confidence_score * 100) if confidence_score <= 1 else round(confidence_score)

    subject = f"Lazarus Blueprint: {drug_name} ({asset_code}) - {proposed_indication}"

    text_body = (
        f"LAZARUS EXECUTIVE BLUEPRINT\n"
        f"{'=' * 40}\n\n"
        f"Drug: {drug_name} ({asset_code})\n"
        f"Target: {proposed_indication}\n"
        f"Confidence: {conf_pct}%\n"
        f"Recommendation: {recommendation}\n\n"
        f"The executive blueprint PDF is attached.\n"
    )

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 20px; color: white;">Lazarus Executive Blueprint</h1>
      </div>
      <div style="padding: 32px;">
        <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #c4b5fd;">
            {drug_name} <span style="color: #94a3b8; font-weight: normal;">({asset_code})</span>
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #94a3b8; width: 160px;">Target Indication</td>
              <td style="padding: 8px 0; color: #a78bfa; font-weight: 600;">{proposed_indication}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Confidence</td>
              <td style="padding: 8px 0;">
                <span style="background: #6366f1; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 14px;">{conf_pct}%</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94a3b8;">Recommendation</td>
              <td style="padding: 8px 0; color: #e2e8f0; font-weight: 600;">{recommendation}</td>
            </tr>
          </table>
        </div>
        <div style="background: #1e293b; border-radius: 8px; padding: 20px; border-left: 3px solid #6366f1;">
          <p style="margin: 0; color: #94a3b8; font-size: 14px;">The full executive blueprint PDF is attached to this email.</p>
        </div>
      </div>
      <div style="background: #1e293b; padding: 16px 32px; text-align: center;">
        <p style="margin: 0; color: #475569; font-size: 12px;">Lazarus Drug Repurposing Platform</p>
      </div>
    </div>
    """

    pdf = Path(pdf_path)
    return _send_email(
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        recipient_override=recipient_email,
        attachments=[pdf] if pdf.exists() else [],
    )
