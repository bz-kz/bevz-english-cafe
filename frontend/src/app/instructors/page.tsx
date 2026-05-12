import { Metadata } from 'next';
import { TeachersGridSection } from '@/components/sections/TeachersGridSection';
import { CTASection } from '@/components/sections/CTASection';
import { Container } from '@/components/ui';
import { generatePageMetadata } from '@/utils/metadata';

export const metadata: Metadata = generatePageMetadata(
  '講師紹介',
  '経験豊富なネイティブ講師陣があなたの英語学習をサポートします。アメリカ、イギリス、カナダ出身の講師が在籍し、それぞれの専門分野でレッスンを提供しています。',
  '/instructors',
  undefined,
  ['ネイティブ講師', 'アメリカ人講師', 'イギリス人講師', 'カナダ人講師', 'TESOL', 'TEFL']
);

export default function InstructorsPage() {
  return (
    <main>
      {/* ページヘッダー */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <Container>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              講師紹介
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              経験豊富なネイティブ講師陣があなたの英語学習をサポートします
            </p>
          </div>
        </Container>
      </section>

      {/* 講師一覧 */}
      <TeachersGridSection />
      
      {/* CTA */}
      <CTASection 
        variant="primary"
        title="お気に入りの講師は見つかりましたか？"
        description="無料体験レッスンで、講師との相性を確認してみませんか？あなたに最適な講師がきっと見つかります。"
        primaryButtonText="無料体験レッスンを予約"
        secondaryButtonText="お問い合わせ"
      />
    </main>
  );
}