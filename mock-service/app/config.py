from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017/api_gateway_dev"

    # App
    FASTAPI_ENV: str = "development"
    LOG_LEVEL: str = "debug"

    # Shared admin DB for error_logs (same MongoDB, explicit for clarity)
    ADMIN_DB_URL: str = "mongodb://localhost:27017/api_gateway_dev"

    # Error log handler
    ERROR_LOG_MIN_LEVEL: str = "WARNING"   # WARNING | ERROR | CRITICAL

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
