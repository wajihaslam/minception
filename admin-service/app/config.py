from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017/api_gateway_dev"

    # JWT
    JWT_SECRET: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Seeded admin account
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@simpaisa.com"
    ADMIN_PASSWORD: str = "changeme123"

    # Inter-service
    MOCK_SERVICE_URL: str = "http://mock-service:8001"

    # App
    FASTAPI_ENV: str = "development"
    LOG_LEVEL: str = "debug"

    # Error log handler
    ERROR_LOG_MIN_LEVEL: str = "WARNING"   # WARNING | ERROR | CRITICAL
    ERROR_LOG_RETENTION_DAYS: int = 90



settings = Settings()
