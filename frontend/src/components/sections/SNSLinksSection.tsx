/**
 * SNS Links Section Component
 * SNS連携機能を提供するコンポーネント
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Container, Card, Button, Badge, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';

interface SNSConfig {
    lineId: string;
    facebookUrl: string;
    instagramUrl: string;
    twitterUrl?: string;
    youtubeUrl?: string;
}

// SNS設定（実際の実装では環境変数や設定ファイルから取得）
const snsConfig: SNSConfig = {
    lineId: 'englishcafe',
    facebookUrl: 'https://facebook.com/englishcafe',
    instagramUrl: 'https://instagram.com/englishcafe',
    twitterUrl: 'https://twitter.com/englishcafe',
    youtubeUrl: 'https://youtube.com/@englishcafe'
};

interface SNSLinksSectionProps {
    className?: string;
    variant?: 'default' | 'compact' | 'detailed';
    showQRCode?: boolean;
}

export function SNSLinksSection({
    className,
    variant = 'default',
    showQRCode = true
}: SNSLinksSectionProps) {
    const [showLineQR, setShowLineQR] = useState(false);

    // LINE QRコードURL生成
    const generateLineQRCode = (size: number = 200) => {
        const lineUrl = `https://line.me/R/ti/p/@${snsConfig.lineId}`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(lineUrl)}`;
    };

    // SNSリンクのクリック追跡
    const handleSNSClick = (platform: string, url: string) => {
        // アナリティクス追跡（実装時に追加）
        console.log(`SNS click: ${platform}`);

        // 外部リンクを開く
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // コンパクト版の表示
    if (variant === 'compact') {
        return (
            <div className={cn('flex items-center space-x-4', className)}>
                <span className="text-sm text-gray-600">フォローする:</span>
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => handleSNSClick('LINE', `https://line.me/R/ti/p/@${snsConfig.lineId}`)}
                    >
                        LINE
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                        onClick={() => handleSNSClick('Facebook', snsConfig.facebookUrl)}
                    >
                        Facebook
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-pink-500 text-pink-600 hover:bg-pink-50"
                        onClick={() => handleSNSClick('Instagram', snsConfig.instagramUrl)}
                    >
                        Instagram
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <section className={cn('py-12', className)}>
            <Container>
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        SNSでつながろう
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        最新情報やレッスンの様子をSNSで発信しています。お気軽にフォロー・友達追加してください！
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* LINE */}
                    <Card className="p-6 hover:shadow-lg transition-shadow">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                </svg>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-2">LINE公式アカウント</h3>
                            <p className="text-gray-600 mb-4">
                                お気軽にメッセージをお送りください。レッスンのご予約やご質問にお答えします。
                            </p>

                            <Badge variant="success" className="mb-4">
                                即座に返信
                            </Badge>

                            <div className="space-y-3">
                                <Button
                                    className="w-full bg-green-500 hover:bg-green-600"
                                    onClick={() => handleSNSClick('LINE', `https://line.me/R/ti/p/@${snsConfig.lineId}`)}
                                >
                                    友達追加
                                </Button>

                                {showQRCode && (
                                    <Button
                                        variant="outline"
                                        className="w-full border-green-500 text-green-600 hover:bg-green-50"
                                        onClick={() => setShowLineQR(true)}
                                    >
                                        QRコードで追加
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Facebook */}
                    <Card className="p-6 hover:shadow-lg transition-shadow">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-2">Facebook</h3>
                            <p className="text-gray-600 mb-4">
                                最新のお知らせやイベント情報、英語学習のコツなどを投稿しています。
                            </p>

                            <Badge variant="primary" className="mb-4">
                                毎日更新
                            </Badge>

                            <div className="space-y-3">
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                    onClick={() => handleSNSClick('Facebook', snsConfig.facebookUrl)}
                                >
                                    ページをフォロー
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                                    onClick={() => handleSNSClick('Facebook Messenger', `${snsConfig.facebookUrl}/messages`)}
                                >
                                    メッセンジャーで連絡
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* Instagram */}
                    <Card className="p-6 hover:shadow-lg transition-shadow">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.297-3.323C5.902 8.198 7.053 7.708 8.35 7.708s2.448.49 3.323 1.297c.897.875 1.387 2.026 1.387 3.323s-.49 2.448-1.297 3.323c-.875.897-2.026 1.387-3.323 1.387zm7.718 0c-1.297 0-2.448-.49-3.323-1.297-.897-.875-1.387-2.026-1.387-3.323s.49-2.448 1.297-3.323c.875-.897 2.026-1.387 3.323-1.387s2.448.49 3.323 1.297c.897.875 1.387 2.026 1.387 3.323s-.49 2.448-1.297 3.323c-.875.897-2.026 1.387-3.323 1.387z" />
                                </svg>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-2">Instagram</h3>
                            <p className="text-gray-600 mb-4">
                                レッスンの様子や講師の日常、英語学習のヒントを写真と動画で紹介。
                            </p>

                            <Badge variant="warning" className="mb-4">
                                写真・動画
                            </Badge>

                            <div className="space-y-3">
                                <Button
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                    onClick={() => handleSNSClick('Instagram', snsConfig.instagramUrl)}
                                >
                                    フォローする
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full border-pink-500 text-pink-600 hover:bg-pink-50"
                                    onClick={() => handleSNSClick('Instagram DM', `${snsConfig.instagramUrl}/direct/inbox/`)}
                                >
                                    DMで連絡
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 追加SNS（詳細版の場合） */}
                {variant === 'detailed' && (
                    <div className="grid md:grid-cols-2 gap-8 mt-8">
                        {/* Twitter */}
                        {snsConfig.twitterUrl && (
                            <Card className="p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900">Twitter</h4>
                                        <p className="text-sm text-gray-600">英語学習のコツを毎日ツイート</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => snsConfig.twitterUrl && handleSNSClick('Twitter', snsConfig.twitterUrl)}
                                    >
                                        フォロー
                                    </Button>


                                </div>
                            </Card>
                        )}

                        {/* YouTube */}
                        {snsConfig.youtubeUrl && (
                            <Card className="p-6">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900">YouTube</h4>
                                        <p className="text-sm text-gray-600">レッスン動画や講師紹介</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => snsConfig.youtubeUrl && handleSNSClick('YouTube', snsConfig.youtubeUrl)}
                                    >
                                        チャンネル登録
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </div>
                )}

                {/* 注意事項 */}
                <div className="mt-12 text-center">
                    <div className="bg-blue-50 rounded-lg p-6 max-w-2xl mx-auto">
                        <h4 className="font-semibold text-blue-900 mb-2">SNSからのお問い合わせについて</h4>
                        <p className="text-sm text-blue-800">
                            各SNSのメッセージ機能からもお気軽にお問い合わせください。
                            営業時間内（平日10:00-22:00、土日祝10:00-20:00）にご返信いたします。
                        </p>
                    </div>
                </div>
            </Container>

            {/* LINE QRコードモーダル */}
            <Modal
                isOpen={showLineQR}
                onClose={() => setShowLineQR(false)}
                title="LINE友達追加"
            >
                <div className="text-center p-6">
                    <p className="text-gray-600 mb-6">
                        下記のQRコードをLINEアプリで読み取って友達追加してください
                    </p>

                    <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
                        <Image
                            src={generateLineQRCode(200)}
                            alt="LINE QRコード"
                            width={200}
                            height={200}
                            className="mx-auto"
                        />
                    </div>

                    <div className="mt-6 space-y-3">
                        <p className="text-sm text-gray-500">
                            ID: @{snsConfig.lineId}
                        </p>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowLineQR(false)}
                            >
                                閉じる
                            </Button>
                            <Button
                                className="flex-1 bg-green-500 hover:bg-green-600"
                                onClick={() => {
                                    handleSNSClick('LINE', `https://line.me/R/ti/p/@${snsConfig.lineId}`);
                                    setShowLineQR(false);
                                }}
                            >
                                LINEアプリで開く
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>
        </section>
    );
}