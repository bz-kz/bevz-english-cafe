"""値オブジェクトのテスト"""

import pytest

from app.domain.value_objects.email import Email
from app.domain.value_objects.phone import Phone


class TestEmail:
    """Email値オブジェクトのテスト"""
    
    def test_valid_email_creation(self):
        """有効なメールアドレスでの作成テスト"""
        email = Email.create("test@example.com")
        assert email.value == "test@example.com"
        assert str(email) == "test@example.com"
    
    def test_email_normalization(self):
        """メールアドレスの正規化テスト"""
        email = Email.create("  TEST@EXAMPLE.COM  ")
        assert email.value == "test@example.com"
    
    def test_invalid_email_format(self):
        """無効なメールアドレス形式のテスト"""
        with pytest.raises(ValueError, match="無効なメールアドレス形式です"):
            Email.create("invalid-email")
        
        with pytest.raises(ValueError, match="無効なメールアドレス形式です"):
            Email.create("test@")
        
        with pytest.raises(ValueError, match="無効なメールアドレス形式です"):
            Email.create("@example.com")
    
    def test_empty_email(self):
        """空のメールアドレスのテスト"""
        with pytest.raises(ValueError, match="メールアドレスは必須です"):
            Email.create("")
        
        with pytest.raises(ValueError, match="メールアドレスは必須です"):
            Email.create("   ")
    
    def test_email_properties(self):
        """メールアドレスのプロパティテスト"""
        email = Email.create("user@example.com")
        assert email.domain == "example.com"
        assert email.local_part == "user"
    
    def test_email_equality(self):
        """メールアドレスの等価性テスト"""
        email1 = Email.create("test@example.com")
        email2 = Email.create("test@example.com")
        email3 = Email.create("other@example.com")
        
        assert email1 == email2
        assert email1 != email3


class TestPhone:
    """Phone値オブジェクトのテスト"""
    
    def test_valid_mobile_phone(self):
        """有効な携帯電話番号のテスト"""
        phone = Phone.create("090-1234-5678")
        assert phone.value == "09012345678"
    
    def test_valid_landline_phone(self):
        """有効な固定電話番号のテスト"""
        phone = Phone.create("03-1234-5678")
        assert phone.value == "0312345678"
    
    def test_phone_normalization(self):
        """電話番号の正規化テスト"""
        # ハイフンあり
        phone1 = Phone.create("090-1234-5678")
        assert phone1.value == "09012345678"
        
        # 空白あり
        phone2 = Phone.create("090 1234 5678")
        assert phone2.value == "09012345678"
        
        # 括弧あり
        phone3 = Phone.create("(090) 1234-5678")
        assert phone3.value == "09012345678"
        
        # 国際番号形式
        phone4 = Phone.create("+81-90-1234-5678")
        assert phone4.value == "09012345678"
    
    def test_invalid_phone_format(self):
        """無効な電話番号形式のテスト"""
        with pytest.raises(ValueError, match="無効な電話番号形式です"):
            Phone.create("123-456-789")  # 短すぎる
        
        with pytest.raises(ValueError, match="無効な電話番号形式です"):
            Phone.create("abc-defg-hijk")  # 文字が含まれる
    
    def test_empty_phone(self):
        """空の電話番号のテスト"""
        with pytest.raises(ValueError, match="電話番号は必須です"):
            Phone.create("")
    
    def test_optional_phone_creation(self):
        """オプショナルな電話番号作成のテスト"""
        # None の場合
        phone = Phone.create_optional(None)
        assert phone is None
        
        # 空文字の場合
        phone = Phone.create_optional("")
        assert phone is None
        
        # 有効な値の場合
        phone = Phone.create_optional("090-1234-5678")
        assert phone is not None
        assert phone.value == "09012345678"
    
    def test_phone_formatting(self):
        """電話番号のフォーマットテスト"""
        # 携帯電話
        phone1 = Phone.create("09012345678")
        assert phone1.formatted() == "090-1234-5678"
        
        # 固定電話（03）
        phone2 = Phone.create("0312345678")
        assert phone2.formatted() == "03-1234-5678"
        
        # フリーダイヤル
        phone3 = Phone.create("0120123456")
        assert phone3.formatted() == "0120-123-456"
    
    def test_phone_equality(self):
        """電話番号の等価性テスト"""
        phone1 = Phone.create("090-1234-5678")
        phone2 = Phone.create("09012345678")
        phone3 = Phone.create("080-1234-5678")
        
        assert phone1 == phone2  # 正規化後は同じ
        assert phone1 != phone3