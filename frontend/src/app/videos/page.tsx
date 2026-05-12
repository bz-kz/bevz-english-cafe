/**
 * Videos Page
 * 動画ギャラリーページ
 */

import { Metadata } from 'next';
import { VideoGallery } from '@/components/ui/VideoGallery';
import { videoSections } from '@/data/videos';
import { generatePageMetadata } from '@/utils/metadata';

export const metadata: Metadata = generatePageMetadata(
  '動画ギャラリー',
  '英会話カフェの講師紹介、レッスン風景、生徒さんの声など、様々な動画コンテンツをご覧いただけます。実際の雰囲気を感じてください。',
  '/videos',
  undefined,
  ['動画', '講師紹介動画', 'レッスン風景', '生徒の声', 'YouTube', 'カフェ紹介']
);

export default function VideosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              動画ギャラリー
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              英会話カフェの魅力を動画でご紹介
            </p>
            <p className="text-lg text-blue-200 max-w-2xl mx-auto">
              経験豊富な講師陣、実際のレッスン風景、生徒さんの体験談など、
              当カフェの雰囲気を動画でお楽しみください。
            </p>
          </div>
        </div>
      </section>

      {/* 動画ギャラリー */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <VideoGallery
            sections={videoSections}
            showCategories={true}
            showSearch={true}
            showFilters={true}
          />
        </div>
      </section>

      {/* CTA セクション */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              実際のレッスンを体験してみませんか？
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              動画でご覧いただいた雰囲気を、ぜひ実際に体験してください。
              無料体験レッスンも承っております。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
              >
                無料体験レッスンを申し込む
              </a>
              <a
                href="/lessons"
                className="inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
              >
                レッスン詳細を見る
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}