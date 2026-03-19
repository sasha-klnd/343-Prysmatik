import os
import smtplib
from email.message import EmailMessage


def send_email(to_email: str, subject: str, body: str, *, html: str | None = None) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_email = os.getenv("SMTP_FROM", username)

    if not host or not username or not password or not from_email:
        print("[EMAIL] SMTP not configured, skipping email:", subject)
        return

    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject

    # Plain text fallback (always)
    msg.set_content(body)

    # Optional HTML version
    if html:
        msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(msg)
