"""Notification helpers for booking confirmations."""
from __future__ import annotations

import asyncio
import base64
from datetime import datetime
from io import BytesIO
from typing import Optional

from app.config import get_settings
from app.services.supabase import get_supabase_service

try:
    from fpdf import FPDF  # type: ignore

    PDF_ENABLED = True
except Exception:
    PDF_ENABLED = False

try:
    import segno  # type: ignore

    QR_ENABLED = True
except Exception:
    segno = None  # type: ignore
    QR_ENABLED = False

try:
    import resend  # type: ignore

    RESEND_AVAILABLE = True
except Exception:
    resend = None  # type: ignore
    RESEND_AVAILABLE = False


def _format_datetime(iso_str: str) -> str:
    """Format ISO datetime strings into a readable local string."""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%B %d, %Y %I:%M %p")
    except Exception:
        return iso_str


def _build_checkin_url(booking_id: str) -> str:
    """Construct the check-in URL for a booking."""
    settings = get_settings()
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/checkin/{booking_id}"


def _generate_checkin_qr_png(data: str) -> Optional[bytes]:
    """Generate a QR code PNG for the provided data."""
    if not QR_ENABLED:
        return None

    buffer = BytesIO()
    segno.make(data, error="h").save(buffer, kind="png", scale=6, border=2)
    return buffer.getvalue()


def _build_booking_pdf(
    booking: dict,
    user_profile: Optional[dict],
    payment: Optional[dict] = None,
    checkin_url: Optional[str] = None,
    qr_png: Optional[bytes] = None,
) -> Optional[bytes]:
    """Create a booking invoice PDF with optional check-in QR."""
    if not PDF_ENABLED:
        return None

    space = booking.get("spaces") or {}
    
    # Initialize PDF with proper settings
    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.set_margins(left=20, top=20, right=20)
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    
    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 10, "Booking Invoice", ln=1, align='C')
    pdf.ln(5)
    
    # Booking Information Section
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, "Booking Information", ln=1)
    pdf.ln(2)
    
    pdf.set_font("Helvetica", "", 11)
    
    # Use cell() with proper width calculation instead of multi_cell for simple lines
    effective_width = pdf.w - pdf.l_margin - pdf.r_margin
    
    booking_info = [
        ("Booking ID:", booking.get('id', 'N/A')),
        ("Guest:", user_profile.get('full_name') or user_profile.get('email') or 'Guest'),
        ("Email:", user_profile.get('email', 'N/A') if user_profile else 'N/A'),
        ("Space:", space.get('name', 'N/A')),
        ("Location:", space.get('location', '') or 'Kuala Lumpur'),
        ("Check-in:", _format_datetime(booking.get('start_time', ''))),
        ("Check-out:", _format_datetime(booking.get('end_time', ''))),
        ("Attendees:", str(booking.get('attendees_count', 1))),
        ("Status:", booking.get('status', '').capitalize() or 'Confirmed'),
    ]
    
    for label, value in booking_info:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(40, 7, label, 0)
        pdf.set_font("Helvetica", "", 11)
        # Use cell with proper text handling
        pdf.cell(0, 7, str(value)[:80], 0, 1)  # Truncate very long values
    
    # Payment Details Section
    if payment:
        pdf.ln(5)
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 8, "Payment Details", ln=1)
        pdf.ln(2)
        
        payment_info = [
            ("Amount:", f"RM {float(payment.get('amount', booking.get('total_amount', 0) or 0)):.2f}"),
            ("Currency:", payment.get('currency', 'MYR')),
            ("Status:", payment.get('payment_status', 'completed').capitalize()),
            ("Transaction ID:", payment.get('transaction_id', 'N/A')[:50]),  # Truncate long IDs
            ("Paid At:", _format_datetime(payment.get('paid_at')) if payment.get('paid_at') else 'N/A'),
        ]
        
        pdf.set_font("Helvetica", "", 11)
        for label, value in payment_info:
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(40, 7, label, 0)
            pdf.set_font("Helvetica", "", 11)
            pdf.cell(0, 7, str(value), 0, 1)
    
    # Total Amount (highlighted)
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(40, 10, "Total Paid:", 0, 0, fill=True)
    pdf.cell(0, 10, f"RM {float(booking.get('total_amount', 0) or 0):.2f}", 0, 1, fill=True)
    
    # Check-in Section
    if checkin_url:
        pdf.ln(8)
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 8, "Check-in Information", ln=1)
        pdf.ln(2)
        
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 7, "Scan the QR code below or visit the link to check in:", 0, 1)
        
        # Add QR code image
        if qr_png:
            try:
                pdf.ln(3)
                # Center the QR code
                qr_width = 60
                x_position = (pdf.w - qr_width) / 2
                pdf.image(BytesIO(qr_png), x=x_position, w=qr_width)
                pdf.ln(5)
            except Exception as e:
                print(f"Warning: Could not embed QR code in PDF: {e}")
        
        # Check-in URL (with line break handling for long URLs)
        pdf.ln(3)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(0, 0, 255)  # Blue for URL
        # Split URL if too long
        if len(checkin_url) > 60:
            pdf.multi_cell(0, 5, checkin_url, align='C')
        else:
            pdf.cell(0, 5, checkin_url, 0, 1, 'C')
        pdf.set_text_color(0, 0, 0)  # Reset to black
    
    # Footer message
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 10)
    pdf.multi_cell(0, 5, "Thank you for choosing Infinity8. Please present this confirmation upon arrival.", align='C')
    
    # Return PDF as bytes
    # Note: pdf.output() returns bytes or bytearray, no need to encode
    output = pdf.output(dest="S")
    if isinstance(output, (bytes, bytearray)):
        return bytes(output)
    else:
        # Fallback for older FPDF versions that return string
        return output.encode("latin-1")


def _send_email_with_attachment(
    to_email: str,
    subject: str,
    body: str,
    attachment: Optional[bytes],
    attachment_name: str,
    html_body: Optional[str] = None,
) -> None:
    """Send an email with an optional attachment via Resend."""
    settings = get_settings()
    if not (settings.RESEND_API_KEY and settings.RESEND_FROM):
        raise RuntimeError("Resend configuration is missing; cannot send email.")
    if not RESEND_AVAILABLE:
        raise RuntimeError("Resend SDK not installed; cannot send email.")

    resend.api_key = settings.RESEND_API_KEY

    attachments = []
    if attachment:
        attachments.append(
            {
                "filename": attachment_name,
                "content": base64.b64encode(attachment).decode("utf-8"),
                "encoding": "base64",
            }
        )

    html_body = html_body or "<br>".join(body.splitlines())

    resend.Emails.send(
        {  # Resend expects base64 + encoding for binary attachments
            "from": settings.RESEND_FROM,
            "to": [to_email],
            "subject": subject,
            "text": body,
            "html": html_body,
            "attachments": attachments or None,
        }
    )


async def send_booking_confirmation_email(
    booking_id: str,
    fallback_email: Optional[str] = None,
) -> None:
    """
    Build a PDF receipt for a booking and email it to the user.

    Idempotent: skips sending if payment receipt_url is already marked as sent.
    """
    settings = get_settings()
    if not settings.RESEND_API_KEY or not settings.RESEND_FROM:
        print("Resend not configured; skipping booking confirmation email.")
        return
    if not RESEND_AVAILABLE:
        print("Resend SDK not installed; skipping booking confirmation email.")
        return

    supabase = get_supabase_service()
    booking = await supabase.get_booking_by_id(booking_id)
    if not booking:
        print(f"Booking {booking_id} not found; cannot send confirmation email.")
        return

    payment = await supabase.get_payment_by_booking(booking_id)
    if payment and payment.get("receipt_url") == "email_sent":
        # Already sent a confirmation for this booking
        return

    user_profile = await supabase.get_user_profile(booking.get("user_id", ""))
    recipient = (user_profile or {}).get("email") or fallback_email

    # If we still don't have an email, try Stripe PaymentIntent details from the payment record.
    if not recipient and payment and payment.get("transaction_id"):
        try:
            import stripe  # type: ignore

            stripe.api_key = settings.STRIPE_SECRET_KEY
            pi = stripe.PaymentIntent.retrieve(payment["transaction_id"])
            recipient = (
                getattr(pi, "receipt_email", None)
                or getattr(getattr(pi, "charges", None), "data", [{}])[0]
                .get("billing_details", {})
                .get("email")
            )
        except Exception as exc:
            print(f"Could not fetch email from Stripe for booking {booking_id}: {exc}")

    if not recipient:
        print(f"No email available for booking {booking_id}; skipping send.")
        return

    space = booking.get("spaces") or {}
    date_label = _format_datetime(booking.get("start_time", ""))
    subject = f"Booking confirmed: {space.get('name', 'Your space')} on {date_label}"

    checkin_url = _build_checkin_url(booking_id)
    qr_png = _generate_checkin_qr_png(checkin_url)
    qr_base64 = base64.b64encode(qr_png).decode("utf-8") if qr_png else None

    body_lines = [
        f"Hi {user_profile.get('full_name') or 'there'},",
        "",
        "Thank you for your payment. Here is your booking information:",
        f"- Space: {space.get('name', '')}",
        f"- Location: {space.get('location', '') or 'Kuala Lumpur'}",
        f"- Starts: {date_label}",
        f"- Ends: {_format_datetime(booking.get('end_time', ''))}",
        f"- Attendees: {booking.get('attendees_count', '')}",
        f"- Amount: RM{float(booking.get('total_amount', 0) or 0):.2f}",
        f"- Booking ID: {booking_id}",
        f"- Check-in link: {checkin_url}",
        "",
        "Scan the QR code or use the link above to check in when you arrive.",
        "",
        "-- Infinity8 Team",
    ]
    body = "\n".join(body_lines)

    # Try to generate PDF, but don't fail if it errors
    pdf_bytes = None
    try:
        pdf_bytes = _build_booking_pdf(
            booking,
            user_profile or {},
            payment=payment,
            checkin_url=checkin_url,
            qr_png=qr_png,
        )
    except Exception as pdf_error:
        print(f"Warning: Could not generate PDF for booking {booking_id}: {pdf_error}")
        # Continue without PDF attachment
    
    attachment_name = f"booking-{booking_id}.pdf"

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 16px;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h2 style="margin: 0 0 12px; color: #0f172a;">Booking Invoice</h2>
          <p style="margin: 0 0 12px;">Hi {user_profile.get('full_name') or 'there'},</p>
          <p style="margin: 0 0 12px;">Thank you for your payment. Here is your invoice and check-in information.</p>

          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
            <p style="margin: 4px 0;"><strong>Space:</strong> {space.get('name', '')}</p>
            <p style="margin: 4px 0;"><strong>Location:</strong> {space.get('location', '') or 'Kuala Lumpur'}</p>
            <p style="margin: 4px 0;"><strong>Starts:</strong> {date_label}</p>
            <p style="margin: 4px 0;"><strong>Ends:</strong> {_format_datetime(booking.get('end_time', ''))}</p>
            <p style="margin: 4px 0;"><strong>Attendees:</strong> {booking.get('attendees_count', '')}</p>
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> RM{float(booking.get('total_amount', 0) or 0):.2f}</p>
            <p style="margin: 4px 0;"><strong>Booking ID:</strong> {booking_id}</p>
          </div>

          <div style="text-align: center; padding: 12px; border: 1px dashed #cbd5e1; border-radius: 10px; margin-bottom: 12px;">
            <p style="margin: 0 0 8px; font-weight: bold;">Check-in QR</p>
            {"<img src='data:image/png;base64," + qr_base64 + "' alt='Check-in QR' style='width:200px;height:200px;border:1px solid #e2e8f0;border-radius:12px;padding:8px; margin-bottom: 8px;'/>" if qr_base64 else ""}
            <p style="margin: 0 0 8px;">Scan this code at the venue to check in.</p>
            <p style="margin: 0;"><a href="{checkin_url}" style="color:#047857;">{checkin_url}</a></p>
          </div>

          {f"<p style='margin: 0 0 8px;'>A PDF copy of your invoice is attached for your records.</p>" if pdf_bytes else ""}
          <p style="margin: 0;">-- Infinity8 Team</p>
        </div>
      </body>
    </html>
    """

    try:
        await asyncio.to_thread(
            _send_email_with_attachment,
            recipient,
            subject,
            body,
            pdf_bytes,
            attachment_name,
            html_body=html_body,
        )
        print(f"Successfully sent booking confirmation email for {booking_id} to {recipient}")
    except Exception as exc:
        print(f"Failed to send booking confirmation email for {booking_id}: {exc}")
        return

    # Mark payment record to avoid duplicate sends
    if payment:
        try:
            await supabase.update_payment_status(
                booking_id=booking_id,
                payment_status=payment.get("payment_status", "completed"),
                transaction_id=payment.get("transaction_id"),
                receipt_url=payment.get("receipt_url") or "email_sent",
            )
        except Exception as exc:
            print(f"Warning: could not mark confirmation email as sent ({booking_id}): {exc}")
