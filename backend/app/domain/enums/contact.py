"""
Contact 関連の Enum 定義

問い合わせドメインで使用する列挙型をまとめる
"""

from enum import Enum


class LessonType(Enum):
    """レッスンタイプ"""

    GROUP = "group"
    PRIVATE = "private"
    ONLINE = "online"
    TRIAL = "trial"
    BUSINESS = "business"
    TOEIC = "toeic"
    OTHER = "other"


class PreferredContact(Enum):
    """希望連絡方法"""

    EMAIL = "email"
    PHONE = "phone"
    LINE = "line"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"


class ContactStatus(Enum):
    """問い合わせステータス"""

    PENDING = "pending"  # 未処理
    PROCESSING = "processing"  # 処理中
    COMPLETED = "completed"  # 完了
    CANCELLED = "cancelled"  # キャンセル
