import { Metadata } from 'next';
import { ContactForm } from '@/components/forms/ContactForm';
import { Container, Card, Button } from '@/components/ui';
import { generatePageMetadata } from '@/utils/metadata';

export const metadata: Metadata = generatePageMetadata(
  'お問い合わせ',
  'ご質問やご相談がございましたら、お気軽にお問い合わせください。お問い合わせフォーム、電話、LINE、SNSからご連絡いただけます。',
  '/contact',
  undefined,
  ['お問い合わせ', '体験レッスン申込', 'LINE', 'Facebook', 'Instagram', 'アクセス']
);

export default function ContactPage() {
  return (
    <main>
      {/* ページヘッダー */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <Container>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              お問い合わせ
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              ご質問やご相談がございましたら、お気軽にお問い合わせください
            </p>
          </div>
        </Container>
      </section>

      {/* メインコンテンツ */}
      <section className="py-20 bg-gray-50">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2">
            {/* お問い合わせフォーム */}
            <Card className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  お問い合わせフォーム
                </h2>
                <p className="text-gray-600">
                  下記フォームにご記入いただき、送信してください
                </p>
              </div>
              <ContactForm />
            </Card>

            {/* アクセス情報・SNS */}
            <div className="space-y-8">
              {/* アクセス情報 */}
              <Card className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  アクセス情報
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <svg className="w-5 h-5 text-primary-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      住所
                    </h4>
                    <p className="text-gray-600 ml-7">
                      〒150-0001<br />
                      東京都渋谷区神宮前1-2-3<br />
                      英会話カフェビル 2F
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <svg className="w-5 h-5 text-primary-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V7l-7-5z" clipRule="evenodd" />
                      </svg>
                      アクセス
                    </h4>
                    <p className="text-gray-600 ml-7">
                      JR山手線「原宿駅」徒歩5分<br />
                      東京メトロ「明治神宮前駅」徒歩3分
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <svg className="w-5 h-5 text-primary-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      営業時間
                    </h4>
                    <div className="text-gray-600 ml-7">
                      <p>平日: 10:00 - 22:00</p>
                      <p>土日祝: 10:00 - 20:00</p>
                      <p className="text-sm text-red-600 mt-1">※年末年始は休業</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <svg className="w-5 h-5 text-primary-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      電話番号
                    </h4>
                    <p className="text-gray-600 ml-7">
                      <a href="tel:03-1234-5678" className="hover:text-primary-600 transition-colors">
                        03-1234-5678
                      </a>
                    </p>
                  </div>
                </div>
              </Card>

              {/* SNS連携 */}
              <Card className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  SNSでもお気軽に
                </h3>
                
                <div className="space-y-4">
                  {/* LINE */}
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">LINE公式アカウント</p>
                        <p className="text-sm text-gray-600">お気軽にメッセージをどうぞ</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-green-500 text-green-600 hover:bg-green-50"
                      asChild
                    >
                      <a 
                        href="https://line.me/R/ti/p/@englishcafe" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        友達追加
                      </a>
                    </Button>
                  </div>

                  {/* Facebook */}
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Facebook</p>
                        <p className="text-sm text-gray-600">最新情報をお届け</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      asChild
                    >
                      <a 
                        href="https://facebook.com/englishcafe" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        フォロー
                      </a>
                    </Button>
                  </div>

                  {/* Instagram */}
                  <div className="flex items-center justify-between p-4 bg-pink-50 rounded-lg border border-pink-200">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.297-3.323C5.902 8.198 7.053 7.708 8.35 7.708s2.448.49 3.323 1.297c.897.875 1.387 2.026 1.387 3.323s-.49 2.448-1.297 3.323c-.875.897-2.026 1.387-3.323 1.387zm7.718 0c-1.297 0-2.448-.49-3.323-1.297-.897-.875-1.387-2.026-1.387-3.323s.49-2.448 1.297-3.323c.875-.897 2.026-1.387 3.323-1.387s2.448.49 3.323 1.297c.897.875 1.387 2.026 1.387 3.323s-.49 2.448-1.297 3.323c-.875.897-2.026 1.387-3.323 1.387z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Instagram</p>
                        <p className="text-sm text-gray-600">レッスンの様子を投稿</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-pink-500 text-pink-600 hover:bg-pink-50"
                      asChild
                    >
                      <a 
                        href="https://instagram.com/englishcafe" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        フォロー
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>SNSからのお問い合わせも大歓迎！</strong><br />
                    各SNSのメッセージ機能からもお気軽にご連絡ください。
                  </p>
                </div>
              </Card>

              {/* 地図プレースホルダー */}
              <Card className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  アクセスマップ
                </h3>
                <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm">Google Maps</p>
                    <p className="text-xs">（実装時に埋め込み予定）</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}