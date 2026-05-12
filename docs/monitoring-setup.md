# 無料監視ツール設定ガイド

英会話カフェWebサイトのパフォーマンス監視を無料で実現するための設定ガイドです。

## 1. New Relic（無料プラン）

### 特徴
- **データ取り込み**: 100GB/月まで無料
- **ユーザー**: 1名まで（フルプラットフォームアクセス）
- **データ保持**: 8日間
- **APM**: アプリケーションパフォーマンス監視
- **Browser**: リアルユーザーモニタリング（RUM）

### 設定手順

1. **アカウント作成**
   ```bash
   # New Relicアカウント作成
   https://newrelic.com/signup
   ```

2. **Browser Agentの設定**
   ```javascript
   // 環境変数設定
   NEXT_PUBLIC_NEW_RELIC_LICENSE_KEY=your_license_key
   NEXT_PUBLIC_NEW_RELIC_APP_ID=your_app_id
   ```

3. **監視の開始**
   - ApplicationMonitoring.init() が自動で初期化
   - Web Vitals、エラー、ユーザーアクションを自動追跡

### 監視項目
- ページロード時間
- JavaScript エラー
- AJAX リクエスト
- ユーザーアクション（クリック、フォーム送信）
- Core Web Vitals（LCP、FID、CLS）

## 2. Grafana Cloud（無料プラン）

### 特徴
- **メトリクス**: 10,000シリーズまで無料
- **ログ**: 50GB/月まで無料
- **トレース**: 50GB/月まで無料
- **アラート**: 無制限
- **ダッシュボード**: 無制限

### 設定手順

1. **アカウント作成**
   ```bash
   # Grafana Cloudアカウント作成
   https://grafana.com/auth/sign-up/create-user
   ```

2. **API キーの取得**
   ```bash
   # Grafana Cloud > Settings > API Keys
   # Prometheus Push API用のキーを作成
   ```

3. **環境変数設定**
   ```javascript
   NEXT_PUBLIC_GRAFANA_ENDPOINT=https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push
   NEXT_PUBLIC_GRAFANA_API_KEY=your_api_key
   ```

### カスタムダッシュボード例

```json
{
  "dashboard": {
    "title": "英会話カフェ - パフォーマンス監視",
    "panels": [
      {
        "title": "Core Web Vitals",
        "type": "stat",
        "targets": [
          {
            "expr": "web_vitals_lcp",
            "legendFormat": "LCP"
          },
          {
            "expr": "web_vitals_fid", 
            "legendFormat": "FID"
          },
          {
            "expr": "web_vitals_cls",
            "legendFormat": "CLS"
          }
        ]
      },
      {
        "title": "ページビュー",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(user_actions_total{action=\"page_view\"}[5m])",
            "legendFormat": "ページビュー/分"
          }
        ]
      },
      {
        "title": "エラー率",
        "type": "graph", 
        "targets": [
          {
            "expr": "rate(errors_total[5m])",
            "legendFormat": "エラー/分"
          }
        ]
      }
    ]
  }
}
```

## 3. Google Analytics 4 + Search Console

### 設定手順

1. **Google Analytics 4**
   ```javascript
   // 既に設定済み
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

2. **Google Search Console**
   ```bash
   # サイト登録
   https://search.google.com/search-console
   
   # サイトマップ送信
   https://your-domain.com/sitemap.xml
   ```

3. **Core Web Vitals レポート**
   - Search Console > エクスペリエンス > Core Web Vitals
   - PageSpeed Insights との連携

## 4. Vercel Analytics（Vercelデプロイ時）

### 設定手順

1. **Vercel Analytics有効化**
   ```bash
   # Vercel Dashboard > Project > Analytics
   # Web Vitals monitoring を有効化
   ```

2. **環境変数設定**
   ```javascript
   NEXT_PUBLIC_VERCEL_ANALYTICS=true
   ```

3. **カスタムイベント追跡**
   ```javascript
   import { track } from '@vercel/analytics';
   
   // レッスン予約追跡
   track('lesson_inquiry', { lesson_type: 'private' });
   ```

## 5. 無料プランの制限と対策

### New Relic制限
- **データ保持**: 8日間 → 重要なメトリクスは外部保存
- **ユーザー数**: 1名 → チーム共有アカウント使用

### Grafana Cloud制限
- **メトリクス数**: 10,000シリーズ → 不要なラベル削除
- **データ保持**: 30日間 → 長期保存は別途対応

### 対策
```javascript
// メトリクス送信の最適化
const shouldSendMetric = () => {
  // 本番環境のみ
  if (process.env.NODE_ENV !== 'production') return false;
  
  // サンプリング（10%のユーザーのみ）
  return Math.random() < 0.1;
};

if (shouldSendMetric()) {
  GrafanaMetrics.sendMetric('page_load_time', loadTime);
}
```

## 6. アラート設定

### New Relic アラート
```javascript
// エラー率が5%を超えた場合
{
  "condition": "error_rate > 0.05",
  "notification": "email"
}
```

### Grafana アラート
```yaml
# grafana-alerts.yml
groups:
  - name: performance
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.05
        for: 2m
        annotations:
          summary: "エラー率が高くなっています"
          
      - alert: SlowPageLoad
        expr: web_vitals_lcp > 4000
        for: 1m
        annotations:
          summary: "ページ読み込みが遅くなっています"
```

## 7. 監視ベストプラクティス

### メトリクス選択
```javascript
// 重要なメトリクスに絞る
const criticalMetrics = [
  'web_vitals_lcp',    // ユーザー体験
  'web_vitals_fid',    // インタラクション
  'web_vitals_cls',    // レイアウト安定性
  'errors_total',      // エラー監視
  'user_actions_total' // ビジネスメトリクス
];
```

### サンプリング戦略
```javascript
// 本番環境でのサンプリング
const getSamplingRate = () => {
  const hour = new Date().getHours();
  
  // ピーク時間（9-18時）は高いサンプリング
  if (hour >= 9 && hour <= 18) return 0.2;
  
  // その他の時間は低いサンプリング
  return 0.05;
};
```

### ダッシュボード設計
1. **概要ダッシュボード**: 全体的な健全性
2. **パフォーマンスダッシュボード**: Core Web Vitals
3. **エラーダッシュボード**: エラー分析
4. **ビジネスダッシュボード**: コンバージョン追跡

## 8. コスト管理

### 無料プラン維持のコツ
- 不要なメトリクスの削除
- サンプリング率の調整
- データ保持期間の最適化
- アラートの適切な設定

### 有料プランへの移行タイミング
- 月間PV 10万を超えた場合
- チームメンバーが増えた場合
- より詳細な分析が必要になった場合

## 9. トラブルシューティング

### よくある問題
1. **メトリクスが送信されない**
   - API キーの確認
   - CORS設定の確認
   - ネットワーク接続の確認

2. **データが表示されない**
   - 時間範囲の確認
   - クエリ構文の確認
   - データ保持期間の確認

3. **アラートが動作しない**
   - 閾値の確認
   - 通知設定の確認
   - 条件式の確認

この設定により、月額0円で本格的なアプリケーション監視が実現できます。