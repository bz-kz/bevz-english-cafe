FROM node:20-alpine

WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install --legacy-peer-deps

# ソースコードをコピー
COPY . .

# 環境変数を設定
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 開発サーバーを起動
EXPOSE 3000
CMD ["npm", "run", "dev"]