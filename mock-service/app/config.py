from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017/api_gateway_dev"

    # App
    FASTAPI_ENV: str = "development"
    LOG_LEVEL: str = "debug"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
