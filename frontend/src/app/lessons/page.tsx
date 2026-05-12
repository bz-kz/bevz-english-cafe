import { Metadata } from 'next';
import { LessonsGridSection } from '@/components/sections/LessonsGridSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { CTASection } from '@/components/sections/CTASection';
import { Container } from '@/components/ui';
import { generatePageMetadata } from '@/utils/metadata';

export const metadata: Metadata = generatePageMetadata(
  'レッスン・料金',
  'あなたに最適な学習スタイルを見つけて、英会話力を向上させましょう。グループレッスン、プライベートレッスン、無料体験レッスンをご用意しています。',
  '/lessons',
  undefined,
  ['料金', 'グループレッスン', 'プライベートレッスン', '無料体験', '月謝制', '都度払い']
);

export default function LessonsPage() {
  return (
    <main>
      {/* ページヘッダー */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <Container>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              レッスン・料金
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              あなたに最適な学習スタイルを見つけて、英会話力を向上させましょう
            </p>
          </div>
        </Container>
      </section>

      {/* レッスン一覧 */}
      <LessonsGridSection />
      
      {/* 特徴セクション */}
      <FeaturesSection />
      
      {/* CTA */}
      <CTASection 
        variant="primary"
        title="今すぐレッスンを始めませんか？"
        description="無料体験レッスンで、あなたに最適な学習方法を見つけましょう。経験豊富なネイティブ講師がお待ちしています。"
        primaryButtonText="無料体験レッスンを予約"
        secondaryButtonText="お問い合わせ"
      />
    </main>
  );
}