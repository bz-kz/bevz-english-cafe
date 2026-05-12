import { Metadata } from 'next';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { ServicesSection } from '@/components/sections/ServicesSection';
import { TeachersSection } from '@/components/sections/TeachersSection';
import { YouTubeVideoSection } from '@/components/sections/YouTubeVideoSection';
import { ReviewsSection } from '@/components/sections/ReviewsSection';
import { StatsSection } from '@/components/sections/StatsSection';
import { CTASection } from '@/components/sections/CTASection';
import { generatePageMetadata } from '@/utils/metadata';

export const metadata: Metadata = generatePageMetadata(
  'ホーム',
  '東京の英会話カフェで、ネイティブ講師と楽しく英会話を学びませんか？初心者から上級者まで、あなたのレベルに合わせたレッスンを提供します。無料体験レッスン実施中！',
  '/',
  undefined,
  ['無料体験', 'グループレッスン', 'プライベートレッスン', '原宿', '明治神宮前']
);

export default function Home() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <ServicesSection />
      <TeachersSection />
      <YouTubeVideoSection variant="featured" />
      <ReviewsSection />
      <StatsSection />
      <CTASection />
    </main>
  );
}
