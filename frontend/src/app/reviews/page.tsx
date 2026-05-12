import { ReviewsSection } from '@/components/sections/ReviewsSection';
import { CTASection } from '@/components/sections/CTASection';
import { Container } from '@/components/ui';

export default function ReviewsPage() {
  return (
    <main>
      {/* ページヘッダー */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <Container>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              生徒さんの声
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              実際に通われている生徒さんからの生の声と評価をご覧ください
            </p>
          </div>
        </Container>
      </section>

      {/* レビュー一覧 */}
      <ReviewsSection showAll={true} />
      
      {/* CTA */}
      <CTASection 
        variant="primary"
        title="あなたも英会話を始めませんか？"
        description="多くの生徒さんに選ばれている理由を、無料体験レッスンで実感してください。きっとあなたも満足していただけるはずです。"
        primaryButtonText="無料体験レッスンを予約"
        secondaryButtonText="お問い合わせ"
      />
    </main>
  );
}