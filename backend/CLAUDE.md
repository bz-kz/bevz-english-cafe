# backend/CLAUDE.md

FastAPI + Python 3.12, managed by **uv** (pip 禁止). See `../CLAUDE.md` for the monorepo overview.

## レイヤリング (DDD)

外 → 内のみ。逆流は import-linter が将来 block する想定:

```
api/endpoints  →  services        →  domain/entities + value_objects + enums
api/schemas    →  domain/repositories (interfaces)
                  ↑ implemented by
              infrastructure/repositories (SQLAlchemy)
              infrastructure/event_bus    (in-memory pub/sub)
              infrastructure/event_handlers
              infrastructure/di/container (composition root)
```

- `app/repositories/` という空ディレクトリには絶対に何も置かない。リポジトリは `app/domain/repositories/`（インターフェイス）と `app/infrastructure/repositories/`（実装）の 2 か所のみ。
- Enums は `app/domain/enums/` 配下。entity ファイルに enum を同居させない。
- DI コンテナ (`app/infrastructure/di/container.py`) はシングルトン群（event_bus, email_service, handlers）だけ保持。session を必要とする repository / service は endpoint 側で per-request 組み立て。

## ツール

- ruff が Black / isort / flake8 を兼ねる。それらを個別に入れない / 実行しない。
- `uv run pytest` は `pyproject.toml` で `asyncio_mode=auto` + coverage が常時 ON。追加フラグ不要。
- mypy は `[tool.mypy]` 設定済。`strict=true` だが `include` は `app/domain` と `app/services` だけ（段階拡張中）。

## コメント言語

既存コードのコメント・docstring は日本語。周囲に合わせる（CLAUDE.md ルール）。
