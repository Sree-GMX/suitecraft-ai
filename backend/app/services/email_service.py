import smtplib
from email.message import EmailMessage

from app.core.config import settings


class EmailService:
    def is_configured(self) -> bool:
        return all(
            [
                settings.SMTP_HOST,
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD,
                settings.SMTP_FROM_EMAIL,
                settings.FRONTEND_URL,
            ]
        )

    def send_password_reset_email(self, recipient_email: str, reset_token: str) -> None:
        if not self.is_configured():
            return

        reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={reset_token}"

        message = EmailMessage()
        message["Subject"] = "SuiteCraft password reset"
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = recipient_email
        message.set_content(
            "\n".join(
                [
                    "We received a request to reset your SuiteCraft password.",
                    "",
                    f"Reset your password here: {reset_link}",
                    "",
                    "This link expires in 1 hour.",
                    "If you did not request this, you can ignore this email.",
                ]
            )
        )

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)


email_service = EmailService()
