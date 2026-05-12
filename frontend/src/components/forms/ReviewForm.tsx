/**
 * Review Form Component
 * レビュー投稿フォーム
 */

'use client';

import { useState } from 'react';
import { Input, Textarea, Select, Button, Card } from '@/components/ui';
import { cn } from '@/utils/cn';

interface ReviewFormData {
  studentName: string;
  email: string;
  rating: number;
  comment: string;
  lessonType: 'group' | 'private' | 'trial' | '';
  teacherName: string;
  course: string;
  studyPeriod: string;
  wouldRecommend: boolean;
}

interface ReviewFormProps {
  onSubmit: (data: ReviewFormData) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function ReviewForm({ onSubmit, isSubmitting = false, className }: ReviewFormProps) {
  const [formData, setFormData] = useState<ReviewFormData>({
    studentName: '',
    email: '',
    rating: 0,
    comment: '',
    lessonType: '',
    teacherName: '',
    course: '',
    studyPeriod: '',
    wouldRecommend: true
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ReviewFormData, string>>>({});

  const lessonTypeOptions = [
    { value: '', label: '選択してください' },
    { value: 'group', label: 'グループレッスン' },
    { value: 'private', label: 'プライベートレッスン' },
    { value: 'trial', label: '体験レッスン' }
  ];

  const teacherOptions = [
    { value: '', label: '選択してください' },
    { value: 'Sarah Johnson', label: 'Sarah Johnson' },
    { value: 'James Wilson', label: 'James Wilson' },
    { value: 'Emma Thompson', label: 'Emma Thompson' },
    { value: 'Michael Brown', label: 'Michael Brown' },
    { value: 'Lisa Davis', label: 'Lisa Davis' },
    { value: 'David Miller', label: 'David Miller' }
  ];

  const studyPeriodOptions = [
    { value: '', label: '選択してください' },
    { value: '1ヶ月未満', label: '1ヶ月未満' },
    { value: '1-3ヶ月', label: '1-3ヶ月' },
    { value: '3-6ヶ月', label: '3-6ヶ月' },
    { value: '6ヶ月-1年', label: '6ヶ月-1年' },
    { value: '1年以上', label: '1年以上' }
  ];

  const handleInputChange = (field: keyof ReviewFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ReviewFormData, string>> = {};

    if (!formData.studentName.trim()) {
      newErrors.studentName = 'お名前は必須です';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    if (formData.rating === 0) {
      newErrors.rating = '評価を選択してください';
    }

    if (!formData.comment.trim()) {
      newErrors.comment = 'レビュー内容は必須です';
    } else if (formData.comment.length < 10) {
      newErrors.comment = 'レビュー内容は10文字以上で入力してください';
    }

    if (!formData.lessonType) {
      newErrors.lessonType = 'レッスンタイプを選択してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    return Array.from({ length: 5 }, (_, i) => (
      <button
        key={i}
        type="button"
        className={cn(
          'w-8 h-8 transition-colors',
          interactive && 'hover:scale-110 transform transition-transform',
          i < rating ? 'text-yellow-400' : 'text-gray-300'
        )}
        onClick={interactive ? () => handleInputChange('rating', i + 1) : undefined}
        disabled={!interactive}
      >
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </button>
    ));
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          レビューを投稿する
        </h3>
        <p className="text-gray-600">
          あなたの体験を他の方と共有してください。投稿されたレビューは承認後に公開されます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label="お名前"
            value={formData.studentName}
            onChange={(e) => handleInputChange('studentName', e.target.value)}
            error={errors.studentName}
            required
            placeholder="山田 太郎"
          />
          <Input
            label="メールアドレス"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={errors.email}
            required
            placeholder="example@email.com"
            helperText="公開されません"
          />
        </div>

        {/* 評価 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            総合評価 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center space-x-2 mb-2">
            {renderStars(formData.rating, true)}
            <span className="text-sm text-gray-600 ml-4">
              {formData.rating > 0 && `${formData.rating}つ星`}
            </span>
          </div>
          {errors.rating && (
            <p className="text-sm text-red-600">{errors.rating}</p>
          )}
        </div>

        {/* レッスン情報 */}
        <div className="grid md:grid-cols-3 gap-4">
          <Select
            label="レッスンタイプ"
            options={lessonTypeOptions}
            value={formData.lessonType}
            onChange={(e) => handleInputChange('lessonType', e.target.value)}
            error={errors.lessonType}
            required
          />
          <Select
            label="担当講師"
            options={teacherOptions}
            value={formData.teacherName}
            onChange={(e) => handleInputChange('teacherName', e.target.value)}
          />
          <Select
            label="受講期間"
            options={studyPeriodOptions}
            value={formData.studyPeriod}
            onChange={(e) => handleInputChange('studyPeriod', e.target.value)}
          />
        </div>

        <Input
          label="コース名"
          value={formData.course}
          onChange={(e) => handleInputChange('course', e.target.value)}
          placeholder="例: ビジネス英語コース、日常英会話など"
        />

        {/* レビュー内容 */}
        <Textarea
          label="レビュー内容"
          value={formData.comment}
          onChange={(e) => handleInputChange('comment', e.target.value)}
          error={errors.comment}
          required
          rows={6}
          placeholder="レッスンの感想、講師について、改善点など、詳しくお聞かせください..."
          helperText={`${formData.comment.length}/1000文字`}
          maxLength={1000}
        />

        {/* 推奨度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            友人にこの英会話カフェを推奨しますか？
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="wouldRecommend"
                checked={formData.wouldRecommend === true}
                onChange={() => handleInputChange('wouldRecommend', true)}
                className="mr-2"
              />
              はい、推奨します
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="wouldRecommend"
                checked={formData.wouldRecommend === false}
                onChange={() => handleInputChange('wouldRecommend', false)}
                className="mr-2"
              />
              いいえ
            </label>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
          <h4 className="font-medium mb-2">投稿に関する注意事項：</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>投稿されたレビューは内容確認後に公開されます</li>
            <li>不適切な内容や虚偽の情報は公開されません</li>
            <li>個人情報は公開されません（お名前はイニシャル表示）</li>
            <li>レビューの編集・削除をご希望の場合はお問い合わせください</li>
          </ul>
        </div>

        {/* 送信ボタン */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'レビューを投稿中...' : 'レビューを投稿する'}
        </Button>
      </form>
    </Card>
  );
}