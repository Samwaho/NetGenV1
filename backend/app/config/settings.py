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

    # Mailtrap Settings
    MAILTRAP_API_TOKEN: str = os.getenv("MAILTRAP_API_TOKEN", "")  # Make it optional with empty default
    MAILTRAP_FROM_EMAIL: str = os.getenv("MAILTRAP_FROM_EMAIL", "info@ispinnacle.co.ke")

    # Gmail Settings (for backward compatibility)
    GMAIL_USERNAME: str | None = os.getenv("GMAIL_USERNAME")
    GMAIL_APP_PASSWORD: str | None = os.getenv("GMAIL_APP_PASSWORD")

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

    # Application Settings
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # Admin User ID
    ADMIN_USER_ID: str = os.getenv("ADMIN_USER_ID")

    # Redis Settings
    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", None)

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")  # development, staging, production

    # Session Cleanup Settings
    OFFLINE_THRESHOLD_MINUTES: int = int(os.getenv("OFFLINE_THRESHOLD_MINUTES", "10"))

    class Config:
        case_sensitive = True
        env_file = ".env"

# Create settings instance
settings = Settings()
