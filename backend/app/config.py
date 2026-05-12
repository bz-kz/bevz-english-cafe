
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """アプリケーション設定"""

    # 基本設定
    app_name: str = "英会話カフェ API"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = True

    # データベース設定
    database_url: str = "postgresql://postgres:password@localhost:5432/english_cafe_db"

    # CORS設定
    cors_origins: str = "http://localhost:3000"

    # メール設定
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_email: str = "info@english-cafe.com"

    # 外部API設定
    youtube_api_key: str = ""
    google_maps_api_key: str = ""
    recaptcha_secret_key: str = ""

    # SNS設定
    line_official_id: str = ""
    facebook_page_url: str = ""
    instagram_url: str = ""

    # セキュリティ設定
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False
    )


# グローバル設定インスタンス
settings = Settings()


def get_settings() -> Settings:
    """設定インスタンスを取得"""
    return settings
