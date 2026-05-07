from pydantic_settings import BaseSettings


class Settings(BaseSettings):
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

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
