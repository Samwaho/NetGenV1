from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    # MongoDB Settings
    MONGODB_URL: str = os.getenv("MONGODB_URL")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME")

    # Security Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY")

    # Application URLs
    FRONTEND_URL: str = os.getenv("FRONTEND_URL")
    API_URL: str = os.getenv("API_URL")
    
    # Email Verification Settings
    EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours
    EMAIL_VERIFICATION_URL: str = os.getenv("EMAIL_VERIFICATION_URL")

    # M-PESA Settings
    MPESA_ENVIRONMENT: str = os.getenv("MPESA_ENVIRONMENT", "sandbox")  # sandbox or production
    MPESA_CONSUMER_KEY: str = os.getenv("MPESA_CONSUMER_KEY")
    MPESA_CONSUMER_SECRET: str = os.getenv("MPESA_CONSUMER_SECRET")
    MPESA_SHORTCODE: str = os.getenv("MPESA_SHORTCODE")
    MPESA_PASSKEY: str = os.getenv("MPESA_PASSKEY")
    MPESA_CALLBACK_URL: str = os.getenv("MPESA_CALLBACK_URL")
    MPESA_TIMEOUT_URL: str = os.getenv("MPESA_TIMEOUT_URL")
    MPESA_RESULT_URL: str = os.getenv("MPESA_RESULT_URL")
    MPESA_INITIATOR_NAME: str = os.getenv("MPESA_INITIATOR_NAME")
    MPESA_INITIATOR_PASSWORD: str = os.getenv("MPESA_INITIATOR_PASSWORD")

    # Google OAuth Settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI")

    # Gmail Settings
    GMAIL_USERNAME: str = os.getenv("GMAIL_USERNAME")
    GMAIL_APP_PASSWORD: str = os.getenv("GMAIL_APP_PASSWORD")

    # Application Settings
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # Admin User ID
    ADMIN_USER_ID: str = os.getenv("ADMIN_USER_ID")

    class Config:
        case_sensitive = True
        env_file = ".env"

# Create settings instance
settings = Settings()
