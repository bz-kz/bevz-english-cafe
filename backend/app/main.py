import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .infrastructure.di.container import get_container
from .api.endpoints.contact import router as contact_router

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    # 起動時の処理
    logger.info("英会話カフェ API starting up...")
    
    # DIコンテナの初期化
    container = get_container()
    logger.info("Dependency injection container initialized")
    logger.info("Domain layer initialized with event bus")
    
    yield
    
    # 終了時の処理
    logger.info("英会話カフェ API shutting down...")


# アプリケーション初期化
app = FastAPI(
    title="英会話カフェ API",
    description="英会話カフェWebサイトのバックエンドAPI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS設定
from .config import get_settings
settings = get_settings()

# 開発環境用のCORS設定
allowed_origins = [
    "http://localhost:3000",  # フロントエンド開発サーバー
    "http://127.0.0.1:3000",  # 代替ローカルホスト
    "https://localhost:3000", # HTTPS版
]

# 環境変数からの追加オリジン
if settings.cors_origins:
    additional_origins = settings.cors_origins.split(",")
    allowed_origins.extend([origin.strip() for origin in additional_origins])

# より寛容なCORS設定でデバッグ
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発環境では全てのオリジンを許可
    allow_credentials=False,  # 全オリジン許可時はcredentialsをFalseにする
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


# ヘルスチェックエンドポイント
@app.get("/health")
async def health_check():
    return JSONResponse(
        content={
            "status": "healthy",
            "message": "英会話カフェ API is running",
        }
    )


# ルートエンドポイント
@app.get("/")
async def root():
    return JSONResponse(
        content={
            "message": "英会話カフェ API",
            "version": "1.0.0",
            "docs": "/docs",
        }
    )


# グローバルOPTIONSハンドラー
@app.options("/{path:path}")
async def options_handler(path: str):
    """全てのパスに対するOPTIONSリクエストハンドラー"""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )


# APIルーターの登録
app.include_router(contact_router, prefix="/api/v1")





if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
