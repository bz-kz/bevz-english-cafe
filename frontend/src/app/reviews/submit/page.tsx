'use client';

import { useState } from 'react';
import { ReviewForm } from '@/components/forms/ReviewForm';
import { Container } from '@/components/ui';
import { useNotificationStore } from '@/stores/notificationStore';

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

export default function SubmitReviewPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { success, error } = useNotificationStore();

  const handleSubmit = async (data: ReviewFormData) => {
    setIsSubmitting(true);

    try {
      // API呼び出し（実装時に追加）
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('レビューの投稿に失敗しました');
      }

      setIsSubmitted(true);
      success('レビューを投稿しました。承認後に公開されます。');
    } catch (err) {
      error(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <main>
        <section className="py-20 bg-gray-50">
          <Container>
            <div className="max-w-2xl mx-auto text-center">
              <div className="text-6xl mb-6">✅</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                レビューを投稿しました
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                ご投稿いただきありがとうございます。<br />
                内容を確認後、サイトに公開させていただきます。
              </p>
              <div className="space-y-4">
                <a
                  href="/reviews"
                  className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  他のレビューを見る
                </a>
                <br />
                <a
                  href="/"
                  className="inline-block text-primary-600 hover:text-primary-700"
                >
                  ホームに戻る
                </a>
              </div>
            </div>
          </Container>
        </section>
      </main>
    );
  }

  return (
    <main>
      {/* ページヘッダー */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <Container>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              レビューを投稿
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              あなたの体験を他の方と共有してください
            </p>
          </div>
        </Container>
      </section>

      {/* レビューフォーム */}
      <section className="py-20 bg-gray-50">
        <Container>
          <div className="max-w-3xl mx-auto">
            <ReviewForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </Container>
      </section>
    </main>
  );
}