FROM python:3.12-slim

WORKDIR /app

# 必要最小限の依存関係のみインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# pipで直接依存関係をインストール（uvは使わない）
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn[standard]==0.24.0 \
    python-multipart==0.0.6 \
    sqlalchemy==2.0.23 \
    alembic==1.13.1 \
    asyncpg==0.29.0 \
    psycopg2-binary==2.9.9 \
    pydantic==2.5.2 \
    pydantic-settings==2.1.0 \
    python-jose[cryptography]==3.3.0 \
    bcrypt==4.1.2 \
    slowapi==0.1.9 \
    aiosmtplib==3.0.1 \
    jinja2==3.1.2 \
    email-validator

# ソースコードをコピー
COPY . .

# アプリケーションを起動
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]