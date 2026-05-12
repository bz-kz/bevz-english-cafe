/**
 * Jest設定 - 統合テスト用
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Next.jsアプリのパスを指定
  dir: './',
});

// Jestのカスタム設定
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  
  // 統合テスト用の設定
  testMatch: [
    '<rootDir>/src/__tests__/integration/**/*.test.{js,jsx,ts,tsx}'
  ],
  
  // テストタイムアウトを長めに設定（API呼び出しのため）
  testTimeout: 10000,
  
  // カバレッジ設定
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  
  // モジュールパスマッピング
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // 環境変数設定
  setupFiles: ['<rootDir>/jest.env.setup.js'],
  
  // 並列実行を制限（統合テストのため）
  maxWorkers: 1,
  
  // テスト実行前後の処理
  globalSetup: '<rootDir>/jest.global-setup.js',
  globalTeardown: '<rootDir>/jest.global-teardown.js',
};

// Next.js設定を適用してエクスポート
module.exports = createJestConfig(customJestConfig);