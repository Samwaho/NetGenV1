from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr, BaseModel
from app.config.settings import settings
from jinja2 import Environment, FileSystemLoader
from pathlib import Path
import logging
from datetime import datetime
from typing import List

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Email configuration
class EmailConfig(BaseModel):
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: EmailStr
    MAIL_PORT: int
    MAIL_SERVER: str
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

# Create email config
email_conf = ConnectionConfig(
    MAIL_USERNAME=settings.GMAIL_USERNAME,
    MAIL_PASSWORD=settings.GMAIL_APP_PASSWORD,
    MAIL_FROM=settings.GMAIL_USERNAME,
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

class EmailManager:
    def __init__(self):
        self.fastmail = FastMail(email_conf)
        
        # Setup Jinja2 environment
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        if not template_dir.exists():
            logger.error(f"Email template directory not found: {template_dir}")
            raise FileNotFoundError(f"Email template directory not found: {template_dir}")
            
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=True
        )

    async def send_email(
        self,
        subject: str,
        recipients: List[str],
        template_name: str,
        context: dict = None
    ) -> bool:
        """Send an email using FastMail with a template."""
        try:
            logger.info(f"Preparing to send email to {recipients}")
            
            # Add common template variables
            context = context or {}
            context.update({
                'year': datetime.now().year,
                'logo_url': f"{settings.FRONTEND_URL}/logo.png",
                'expire_minutes': settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES
            })
            
            # Render template
            template = self.env.get_template(template_name)
            html_content = template.render(**context)
            
            message = MessageSchema(
                subject=subject,
                recipients=recipients,  # FastMail will validate email addresses
                body=html_content,
                subtype="html"
            )
            
            await self.fastmail.send_message(message)
            logger.info(f"Email sent successfully to {recipients}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}", exc_info=True)
            return False

    async def send_verification_email(
        self,
        to_email: str,
        username: str,
        verification_url: str
    ) -> bool:
        """Send verification email to user."""
        try:
            logger.info(f"Sending verification email to {to_email}")
            return await self.send_email(
                subject="Verify your email address",
                recipients=[to_email],  # Pass email as string
                template_name="verification_email.html",
                context={
                    "username": username,
                    "verification_url": verification_url
                }
            )
        except Exception as e:
            logger.error(f"Error sending verification email: {str(e)}", exc_info=True)
            return False

    async def send_password_reset_email(
        self,
        to_email: str,
        username: str,
        reset_url: str
    ) -> bool:
        """Send password reset email"""
        try:
            subject = "Reset Your Password"
            content = {
                "username": username,
                "reset_url": reset_url,
                "expires_in": "1 hour"
            }
            
            # Send email directly without background tasks
            return await self.send_email(
                subject=subject,
                recipients=[to_email],  # Changed to_email to recipients list
                template_name="password_reset.html",
                context=content
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}", exc_info=True)
            return False

    async def send_organization_invitation(
        self,
        to_email: str,
        organization_name: str,
        inviter_name: str,
        role_name: str,
        invite_message: str | None,
        invite_link: str
    ) -> None:
        """Send an organization invitation email"""
        try:
            context = {
                "organization_name": organization_name,
                "inviter_name": inviter_name,
                "role_name": role_name,
                "invite_message": invite_message,
                "invite_link": invite_link
            }

            await self.send_email(
                subject=f"Invitation to join {organization_name}",
                recipients=[to_email],
                template_name="organization_invitation.html",
                context=context
            )
        except Exception as e:
            logger.error(f"Failed to send organization invitation email: {str(e)}", exc_info=True)
            raise e

# Create a global instance
email_manager = EmailManager()
