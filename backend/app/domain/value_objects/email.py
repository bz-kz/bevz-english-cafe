"""
Email値オブジェクト

メールアドレスのバリデーションと正規化を行う不変オブジェクト
"""

import re
from dataclasses import dataclass
from typing import Self


@dataclass(frozen=True)
class Email:
    """
    メールアドレス値オブジェクト
    
    不変で等価性を持つメールアドレスを表現
    """
    
    value: str
    
    def __post_init__(self) -> None:
        """初期化後のバリデーション"""
        if not self.value:
            raise ValueError("メールアドレスは必須です")
        
        if not self._is_valid_email(self.value):
            raise ValueError(f"無効なメールアドレス形式です: {self.value}")
        
        # 正規化（小文字化）
        object.__setattr__(self, 'value', self.value.lower().strip())
    
    @staticmethod
    def _is_valid_email(email: str) -> bool:
        """
        メールアドレスの形式をバリデーション
        
        Args:
            email: 検証するメールアドレス
            
        Returns:
            bool: 有効な形式の場合True
        """
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @classmethod
    def create(cls, value: str) -> Self:
        """
        Emailオブジェクトを作成
        
        Args:
            value: メールアドレス文字列
            
        Returns:
            Email: 作成されたEmailオブジェクト
            
        Raises:
            ValueError: 無効なメールアドレスの場合
        """
        return cls(value)
    
    def __str__(self) -> str:
        """文字列表現"""
        return self.value
    
    def __repr__(self) -> str:
        """デバッグ用文字列表現"""
        return f"Email('{self.value}')"
    
    @property
    def domain(self) -> str:
        """
        メールアドレスのドメイン部分を取得
        
        Returns:
            str: ドメイン部分
        """
        return self.value.split('@')[1]
    
    @property
    def local_part(self) -> str:
        """
        メールアドレスのローカル部分を取得
        
        Returns:
            str: ローカル部分（@より前）
        """
        return self.value.split('@')[0]