/**
 * Jest グローバルセットアップ
 * 統合テスト実行前の準備処理
 */

const { spawn } = require('child_process');
const axios = require('axios');

const API_URL = 'http://localhost:8010';
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

/**
 * APIサーバーの起動確認
 */
async function waitForApiServer() {
  console.log('APIサーバーの起動を確認中...');

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await axios.get(`${API_URL}/health`, {
        timeout: 2000,
      });

      if (response.status === 200) {
        console.log('✅ APIサーバーが起動しています');
        return true;
      }
    } catch (error) {
      console.log(`⏳ APIサーバー起動待機中... (${i + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  throw new Error('❌ APIサーバーの起動確認に失敗しました');
}

/**
 * グローバルセットアップ処理
 */
module.exports = async () => {
  console.log('🚀 統合テスト環境のセットアップを開始...');

  try {
    // APIサーバーの起動確認
    await waitForApiServer();

    console.log('✅ 統合テスト環境のセットアップが完了しました');
  } catch (error) {
    console.error('❌ 統合テスト環境のセットアップに失敗:', error.message);
    console.log('💡 バックエンドサーバーが起動していることを確認してください:');
    console.log('   cd backend && npm start');
    process.exit(1);
  }
};
