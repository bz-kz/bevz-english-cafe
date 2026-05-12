/** @type {import('next').NextConfig} */
const nextConfig = {
  // 画像最適化設定（開発時は軽量化）
  images: {
    unoptimized: process.env.NODE_ENV === 'development', // 開発時は最適化を無効化
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
    ],
    formats: process.env.NODE_ENV === 'development' ? [] : ['image/webp', 'image/avif'],
    deviceSizes: process.env.NODE_ENV === 'development' ? [640, 1080, 1920] : [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: process.env.NODE_ENV === 'development' ? [32, 64, 128] : [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: process.env.NODE_ENV === 'development' ? 0 : 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // 実験的機能の有効化
  experimental: {
    // optimizeCss: true, // Docker環境では無効化
    optimizePackageImports: ['@heroicons/react', 'lucide-react'],
    // 開発時のコンパイル最適化
    webpackBuildWorker: true,
    // Turboを無効化してリクエスト中断を減らす
    // turbo: {
    //   rules: {
    //     '*.svg': {
    //       loaders: ['@svgr/webpack'],
    //       as: '*.js',
    //     },
    //   },
    // },
  },
  
  // コンパイラ最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // バンドル分析
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle Analyzer（開発時のみ）
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      );
    }
    
    // 開発時の最適化
    if (dev) {
      // 開発時のコンパイル速度向上
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
      
      // 開発時のキャッシュ設定
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
    }
    
    // 最適化設定
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Next.js chunks
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // UI libraries
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name: 'lib',
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          // Common chunks
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
            reuseExistingChunk: true,
          },
        },
      };
    }
    
    return config;
  },
  
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  
  // 開発サーバーの設定
  devIndicators: {
    buildActivity: false, // ビルドインジケーターを無効化
  },
  
  // リクエスト処理の最適化
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 1分
    pagesBufferLength: 2,
  },
  
  // 開発時のCORS問題を解決
  allowedDevOrigins: ['0.0.0.0:3000', 'localhost:3000'],
  
  // 開発時のCORS設定を追加
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // フォント読み込みのためのCORS設定
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      // Google Fontsのプリコネクト
      {
        source: '/_next/static/css/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // 本番ビルド用の設定
  output: 'standalone',
  
  // パフォーマンス最適化
  poweredByHeader: false,
  generateEtags: true,
  compress: true,

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
