import mailtrap as mt
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

class EmailManager:
    def __init__(self):
        # Setup Jinja2 environment
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        if not template_dir.exists():
            logger.error(f"Email template directory not found: {template_dir}")
            raise FileNotFoundError(f"Email template directory not found: {template_dir}")

        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=True
        )
        
        # Initialize Mailtrap client with token validation
        if not settings.MAILTRAP_API_TOKEN:
            logger.error("MAILTRAP_API_TOKEN is not set in environment variables")
            raise ValueError("MAILTRAP_API_TOKEN is required for email functionality")
            
        logger.info("Initializing Mailtrap client...")
        self.client = mt.MailtrapClient(token=settings.MAILTRAP_API_TOKEN)
        logger.info("Mailtrap client initialized successfully")

    async def send_email(
        self,
        subject: str,
        recipients: List[str],
        template_name: str,
        context: dict = None
    ) -> bool:
        """Send an email using Mailtrap API with a template."""
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

            # Create mail object
            mail = mt.Mail(
                sender=mt.Address(email=settings.MAILTRAP_FROM_EMAIL, name="ISPinnacle"),
                to=[mt.Address(email=email) for email in recipients],
                subject=subject,
                html=html_content,
                category="Transactional"
            )

            # Send email
            logger.info("Attempting to send email via Mailtrap...")
            self.client.send(mail)
            logger.info(f"Email sent successfully to {recipients}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}", exc_info=True)
            if hasattr(e, 'response'):
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
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
                recipients=[to_email],
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
            return await self.send_email(
                subject="Reset Your Password",
                recipients=[to_email],
                template_name="password_reset.html",
                context={
                    "username": username,
                    "reset_url": reset_url,
                    "expires_in": "1 hour"
                }
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
    ) -> bool:
        """Send an organization invitation email"""
        try:
            context = {
                "organization_name": organization_name,
                "inviter_name": inviter_name,
                "role_name": role_name,
                "invite_message": invite_message,
                "invite_link": invite_link
            }

            return await self.send_email(
                subject=f"Invitation to join {organization_name}",
                recipients=[to_email],
                template_name="organization_invitation.html",
                context=context
            )
        except Exception as e:
            logger.error(f"Failed to send organization invitation email: {str(e)}", exc_info=True)
            return False

# Create a global instance
email_manager = EmailManager()
