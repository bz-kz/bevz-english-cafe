/**
 * Access Info Section Component
 * アクセス情報セクションコンポーネント（Google Maps埋め込み、住所・営業時間表示）
 */

'use client';

import { useState } from 'react';
import { Container, Card, Button, Badge } from '@/components/ui';
import { cn } from '@/utils/cn';

interface AccessInfo {
  name: string;
  address: {
    postal: string;
    prefecture: string;
    city: string;
    street: string;
    building: string;
  };
  phone: string;
  email: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  businessHours: {
    weekday: string;
    weekend: string;
    holiday: string;
    closed: string[];
  };
  access: {
    station: string;
    walkTime: string;
    directions: string[];
  }[];
  parking: {
    available: boolean;
    details?: string;
  };
  nearbyLandmarks: string[];
}

// アクセス情報（実際の実装では API や設定ファイルから取得）
const accessInfo: AccessInfo = {
  name: '英会話カフェ',
  address: {
    postal: '150-0001',
    prefecture: '東京都',
    city: '渋谷区',
    street: '神宮前1-2-3',
    building: '英会話カフェビル 2F'
  },
  phone: '03-1234-5678',
  email: 'info@englishcafe.com',
  coordinates: {
    lat: 35.6762,
    lng: 139.7043
  },
  businessHours: {
    weekday: '10:00 - 22:00',
    weekend: '10:00 - 20:00',
    holiday: '10:00 - 18:00',
    closed: ['年末年始（12/29-1/3）']
  },
  access: [
    {
      station: 'JR山手線「原宿駅」',
      walkTime: '徒歩5分',
      directions: [
        '原宿駅竹下口を出る',
        '竹下通りを直進（約300m）',
        '明治通りとの交差点を左折',
        '1つ目の角を右折すぐ'
      ]
    },
    {
      station: '東京メトロ「明治神宮前駅」',
      walkTime: '徒歩3分',
      directions: [
        '明治神宮前駅2番出口を出る',
        '表参道方面へ直進（約200m）',
        '1つ目の角を左折すぐ'
      ]
    },
    {
      station: '東京メトロ「表参道駅」',
      walkTime: '徒歩8分',
      directions: [
        '表参道駅A2出口を出る',
        '表参道を原宿方面へ直進（約600m）',
        '明治通りとの交差点を右折',
        '1つ目の角を右折すぐ'
      ]
    }
  ],
  parking: {
    available: false,
    details: '専用駐車場はございません。近隣のコインパーキングをご利用ください。'
  },
  nearbyLandmarks: [
    '竹下通り',
    '明治神宮',
    '表参道ヒルズ',
    'ラフォーレ原宿',
    '東急プラザ表参道原宿'
  ]
};

interface AccessInfoSectionProps {
  className?: string;
  showMap?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

export function AccessInfoSection({ 
  className, 
  showMap = true,
  variant = 'default' 
}: AccessInfoSectionProps) {
  const [selectedAccess, setSelectedAccess] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Google Maps埋め込みURL生成
  const generateMapUrl = () => {
    const { lat, lng } = accessInfo.coordinates;
    const address = `${accessInfo.address.prefecture}${accessInfo.address.city}${accessInfo.address.street}`;
    return `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodeURIComponent(address)}&center=${lat},${lng}&zoom=16`;
  };

  // 営業時間の表示
  const getCurrentStatus = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0: 日曜日, 1: 月曜日, ...

    // 営業時間の判定（簡易版）
    if (currentDay >= 1 && currentDay <= 5) { // 平日
      if (currentHour >= 10 && currentHour < 22) {
        return { status: 'open', text: '営業中', color: 'text-green-600' };
      }
    } else { // 土日
      if (currentHour >= 10 && currentHour < 20) {
        return { status: 'open', text: '営業中', color: 'text-green-600' };
      }
    }
    
    return { status: 'closed', text: '営業時間外', color: 'text-red-600' };
  };

  const currentStatus = getCurrentStatus();

  // コンパクト版の表示
  if (variant === 'compact') {
    return (
      <div className={cn('bg-white rounded-lg p-6 shadow-sm', className)}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">アクセス</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-primary-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-gray-900">
                {accessInfo.address.prefecture}{accessInfo.address.city}{accessInfo.address.street}
              </p>
              <p className="text-sm text-gray-600">{accessInfo.address.building}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <div>
              <span className="font-medium text-gray-900">営業時間: </span>
              <span className={currentStatus.color}>{currentStatus.text}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={cn('py-20 bg-gray-50', className)}>
      <Container>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            アクセス・営業時間
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            原宿・表参道エリアの便利な立地。複数の駅からアクセス可能です。
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* 地図 */}
          {showMap && (
            <Card className="overflow-hidden">
              <div className="aspect-video bg-gray-200 relative">
                {/* Google Maps埋め込み（実際の実装時にAPIキーを設定） */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <p className="font-medium">Google Maps</p>
                    <p className="text-sm">（実装時に埋め込み予定）</p>
                  </div>
                </div>
                
                {/* 実際のGoogle Maps埋め込み（コメントアウト）
                <iframe
                  src={generateMapUrl()}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={() => setMapLoaded(true)}
                />
                */}
              </div>
              
              <div className="p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{accessInfo.name}</p>
                    <p className="text-sm text-gray-600">
                      {accessInfo.address.prefecture}{accessInfo.address.city}{accessInfo.address.street}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const address = `${accessInfo.address.prefecture}${accessInfo.address.city}${accessInfo.address.street}`;
                      window.open(`https://maps.google.com/maps?q=${encodeURIComponent(address)}`, '_blank');
                    }}
                  >
                    Google Mapsで開く
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* アクセス情報 */}
          <div className="space-y-8">
            {/* 基本情報 */}
            <Card className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">基本情報</h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-primary-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">住所</p>
                    <p className="text-gray-600">
                      〒{accessInfo.address.postal}<br />
                      {accessInfo.address.prefecture}{accessInfo.address.city}{accessInfo.address.street}<br />
                      {accessInfo.address.building}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-primary-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">電話番号</p>
                    <p className="text-gray-600">
                      <a href={`tel:${accessInfo.phone}`} className="hover:text-primary-600 transition-colors">
                        {accessInfo.phone}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-primary-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">メールアドレス</p>
                    <p className="text-gray-600">
                      <a href={`mailto:${accessInfo.email}`} className="hover:text-primary-600 transition-colors">
                        {accessInfo.email}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* 営業時間 */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">営業時間</h3>
                <Badge 
                  variant={currentStatus.status === 'open' ? 'success' : 'error'}
                  className="text-sm"
                >
                  {currentStatus.text}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-900">平日</span>
                  <span className="text-gray-600">{accessInfo.businessHours.weekday}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-900">土日祝</span>
                  <span className="text-gray-600">{accessInfo.businessHours.weekend}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-gray-900">定休日</span>
                  <span className="text-gray-600">{accessInfo.businessHours.closed.join('、')}</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  ※ 営業時間は変更される場合があります。<br />
                  最新情報はお電話でご確認ください。
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* アクセス方法 */}
        <Card className="mt-12 p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">アクセス方法</h3>
          
          {/* 駅選択タブ */}
          <div className="flex flex-wrap gap-2 mb-6">
            {accessInfo.access.map((access, index) => (
              <Button
                key={index}
                variant={selectedAccess === index ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedAccess(index)}
              >
                {access.station} ({access.walkTime})
              </Button>
            ))}
          </div>

          {/* 選択された駅のアクセス方法 */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-primary-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V7l-7-5z" clipRule="evenodd" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-900">
                {accessInfo.access[selectedAccess].station}から{accessInfo.access[selectedAccess].walkTime}
              </h4>
            </div>
            
            <ol className="space-y-2">
              {accessInfo.access[selectedAccess].directions.map((direction, index) => (
                <li key={index} className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{direction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* 駐車場情報 */}
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h5 className="font-medium text-yellow-800">駐車場について</h5>
                <p className="text-sm text-yellow-700 mt-1">{accessInfo.parking.details}</p>
              </div>
            </div>
          </div>

          {/* 近隣ランドマーク */}
          {variant === 'detailed' && (
            <div className="mt-6">
              <h5 className="font-medium text-gray-900 mb-3">近隣ランドマーク</h5>
              <div className="flex flex-wrap gap-2">
                {accessInfo.nearbyLandmarks.map((landmark, index) => (
                  <Badge key={index} variant="default" size="sm">
                    {landmark}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </Container>
    </section>
  );
}