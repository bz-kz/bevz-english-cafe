-- 初期データベーススキーマ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 問い合わせテーブル
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    message TEXT NOT NULL,
    lesson_type VARCHAR(50),
    preferred_contact VARCHAR(20) DEFAULT 'email',
    status VARCHAR(20) DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 講師テーブル（将来実装用）
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    photo VARCHAR(255),
    nationality VARCHAR(50),
    languages TEXT[],
    specialization TEXT[],
    experience TEXT,
    introduction TEXT,
    certifications TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- レッスンテーブル（将来実装用）
CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    price_amount INTEGER NOT NULL,
    price_currency VARCHAR(3) DEFAULT 'JPY',
    price_period VARCHAR(20) DEFAULT 'per_lesson',
    duration INTEGER NOT NULL,
    max_students INTEGER,
    level TEXT[],
    features TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- レビューテーブル（将来実装用）
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_name VARCHAR(100) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    lesson_type VARCHAR(50),
    teacher_id UUID REFERENCES teachers(id),
    helpful_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_contacts_submitted_at ON contacts(submitted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_teachers_is_active ON teachers(is_active);
CREATE INDEX IF NOT EXISTS idx_lessons_is_active ON lessons(is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_is_published ON reviews(is_published);