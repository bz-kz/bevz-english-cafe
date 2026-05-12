"""Tests for Contact API endpoints."""
import pytest
from httpx import AsyncClient
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.contact import LessonType, PreferredContact
from app.services.contact_service import ContactService


class TestContactAPI:
    """Contact API のテストケース"""
    
    @pytest.fixture
    async def client(self, app: FastAPI) -> AsyncClient:
        """テスト用HTTPクライアント"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client
    
    async def test_create_contact_success(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """問い合わせ作成成功テスト"""
        # テストデータ
        contact_data = {
            "name": "山田太郎",
            "email": "yamada@example.com",
            "phone": "090-1234-5678",
            "lesson_type": "trial",
            "preferred_contact": "email",
            "message": "体験レッスンを受けたいです。"
        }
        
        # API呼び出し
        response = await client.post("/api/v1/contacts/", json=contact_data)
        
        # レスポンス検証
        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "お問い合わせを受け付けました。"
        assert "contact_id" in data
        assert len(data["contact_id"]) == 36  # UUID形式
    
    async def test_create_contact_without_phone(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """電話番号なしの問い合わせ作成テスト"""
        contact_data = {
            "name": "佐藤花子",
            "email": "sato@example.com",
            "lesson_type": "group",
            "preferred_contact": "email",
            "message": "グループレッスンに興味があります。"
        }
        
        response = await client.post("/api/v1/contacts/", json=contact_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "お問い合わせを受け付けました。"
    
    async def test_create_contact_invalid_email(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """無効なメールアドレスでの問い合わせ作成テスト"""
        contact_data = {
            "name": "田中次郎",
            "email": "invalid-email",
            "lesson_type": "private",
            "preferred_contact": "email",
            "message": "プライベートレッスンをお願いします。"
        }
        
        response = await client.post("/api/v1/contacts/", json=contact_data)
        
        assert response.status_code == 422  # Validation error
    
    async def test_create_contact_empty_name(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """空の名前での問い合わせ作成テスト"""
        contact_data = {
            "name": "",
            "email": "test@example.com",
            "lesson_type": "business",
            "preferred_contact": "phone",
            "message": "ビジネス英語を学びたいです。"
        }
        
        response = await client.post("/api/v1/contacts/", json=contact_data)
        
        assert response.status_code == 422  # Validation error    

    async def test_create_contact_long_message(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """長すぎるメッセージでの問い合わせ作成テスト"""
        contact_data = {
            "name": "長文太郎",
            "email": "long@example.com",
            "lesson_type": "trial",
            "preferred_contact": "email",
            "message": "あ" * 1001  # 1001文字（制限は1000文字）
        }
        
        response = await client.post("/api/v1/contacts/", json=contact_data)
        
        assert response.status_code == 422  # Validation error
    
    async def test_get_contact_success(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """問い合わせ取得成功テスト"""
        # まず問い合わせを作成
        contact_data = {
            "name": "取得テスト",
            "email": "get@example.com",
            "lesson_type": "private",
            "preferred_contact": "phone",
            "message": "取得テスト用の問い合わせです。"
        }
        
        create_response = await client.post("/api/v1/contacts/", json=contact_data)
        assert create_response.status_code == 201
        contact_id = create_response.json()["contact_id"]
        
        # 作成した問い合わせを取得
        get_response = await client.get(f"/api/v1/contacts/{contact_id}")
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == contact_id
        assert data["name"] == "取得テスト"
        assert data["email"] == "get@example.com"
        assert data["lesson_type"] == "private"
        assert data["preferred_contact"] == "phone"
        assert data["message"] == "取得テスト用の問い合わせです。"
        assert data["status"] == "pending"
        assert "created_at" in data
    
    async def test_get_contact_not_found(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """存在しない問い合わせの取得テスト"""
        fake_id = "123e4567-e89b-12d3-a456-426614174000"
        
        response = await client.get(f"/api/v1/contacts/{fake_id}")
        
        assert response.status_code == 404
        data = response.json()
        assert "指定された問い合わせが見つかりません" in data["detail"]
    
    async def test_get_contact_invalid_uuid(
        self,
        client: AsyncClient,
        async_session: AsyncSession
    ):
        """無効なUUIDでの問い合わせ取得テスト"""
        invalid_id = "invalid-uuid"
        
        response = await client.get(f"/api/v1/contacts/{invalid_id}")
        
        assert response.status_code == 422  # Validation error