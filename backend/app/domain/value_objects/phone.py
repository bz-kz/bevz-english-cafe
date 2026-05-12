"""
Phone値オブジェクト

電話番号のバリデーションと正規化を行う不変オブジェクト
"""

import re
from dataclasses import dataclass
from typing import Optional, Self


@dataclass(frozen=True)
class Phone:
    """
    電話番号値オブジェクト
    
    不変で等価性を持つ電話番号を表現
    """
    
    value: str
    
    def __post_init__(self) -> None:
        """初期化後のバリデーション"""
        if not self.value:
            raise ValueError("電話番号は必須です")
        
        # 正規化
        normalized = self._normalize_phone(self.value)
        
        if not self._is_valid_phone(normalized):
            raise ValueError(f"無効な電話番号形式です: {self.value}")
        
        object.__setattr__(self, 'value', normalized)
    
    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """
        電話番号を正規化
        
        Args:
            phone: 正規化する電話番号
            
        Returns:
            str: 正規化された電話番号
        """
        # 空白、ハイフン、括弧を除去
        normalized = re.sub(r'[\s\-\(\)]', '', phone)
        
        # 先頭の+81を0に変換（日本の国際番号）
        if normalized.startswith('+81'):
            normalized = '0' + normalized[3:]
        elif normalized.startswith('81') and len(normalized) >= 10:
            normalized = '0' + normalized[2:]
        
        return normalized
    
    @staticmethod
    def _is_valid_phone(phone: str) -> bool:
        """
        電話番号の形式をバリデーション
        
        Args:
            phone: 検証する電話番号
            
        Returns:
            bool: 有効な形式の場合True
        """
        # 日本の電話番号パターン
        patterns = [
            r'^0[1-9]\d{8,9}$',  # 固定電話（10-11桁）
            r'^0[789]0\d{8}$',   # 携帯電話（11桁）
            r'^050\d{8}$',       # IP電話（11桁）
            r'^0120\d{6}$',      # フリーダイヤル（10桁）
            r'^0800\d{7}$',      # フリーダイヤル（11桁）
        ]
        
        return any(re.match(pattern, phone) for pattern in patterns)
    
    @classmethod
    def create(cls, value: str) -> Self:
        """
        Phoneオブジェクトを作成
        
        Args:
            value: 電話番号文字列
            
        Returns:
            Phone: 作成されたPhoneオブジェクト
            
        Raises:
            ValueError: 無効な電話番号の場合
        """
        return cls(value)
    
    @classmethod
    def create_optional(cls, value: Optional[str]) -> Optional[Self]:
        """
        オプショナルなPhoneオブジェクトを作成
        
        Args:
            value: 電話番号文字列（Noneも可）
            
        Returns:
            Optional[Phone]: 作成されたPhoneオブジェクト、またはNone
        """
        if value is None or value.strip() == '':
            return None
        return cls.create(value)
    
    def __str__(self) -> str:
        """文字列表現"""
        return self.value
    
    def __repr__(self) -> str:
        """デバッグ用文字列表現"""
        return f"Phone('{self.value}')"
    
    def formatted(self) -> str:
        """
        フォーマットされた電話番号を取得
        
        Returns:
            str: ハイフン区切りの電話番号
        """
        phone = self.value
        
        # 携帯電話（090, 080, 070）
        if phone.startswith(('090', '080', '070')):
            return f"{phone[:3]}-{phone[3:7]}-{phone[7:]}"
        
        # IP電話（050）
        elif phone.startswith('050'):
            return f"{phone[:3]}-{phone[3:7]}-{phone[7:]}"
        
        # フリーダイヤル（0120）
        elif phone.startswith('0120'):
            return f"{phone[:4]}-{phone[4:7]}-{phone[7:]}"
        
        # フリーダイヤル（0800）
        elif phone.startswith('0800'):
            return f"{phone[:4]}-{phone[4:7]}-{phone[7:]}"
        
        # 固定電話（市外局番による分割）
        elif len(phone) == 10:
            # 03, 06などの2桁市外局番
            if phone.startswith(('03', '06')):
                return f"{phone[:2]}-{phone[2:6]}-{phone[6:]}"
            # その他の3桁市外局番
            else:
                return f"{phone[:3]}-{phone[3:6]}-{phone[6:]}"
        
        elif len(phone) == 11:
            # 4桁市外局番
            return f"{phone[:4]}-{phone[4:7]}-{phone[7:]}"
        
        # デフォルト（そのまま返す）
        return phone