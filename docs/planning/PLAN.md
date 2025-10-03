# プロジェクト計画書

## 🎯 プロジェクト概要

**作りたいもの**: AIでネットサービスを誰でも簡単に作れるプラットフォーム

### コンセプト
- TOP画面はChatGPT風のシンプルなチャットUI
- AIだけですべてを完結して様々なサービスを利用できる
- 自然言語でサービスを作成・管理・利用できる

### 差別化ポイント
- 🤖 **AI完結型**: コードを書かずにAIとの対話だけでサービス構築
- 🛠️ **専用ツール**: 予約、物販、フォームなど用途別の最適化されたツール
- 🎨 **リッチな表現**: Markdown以外の表現方法も提供
- 🔌 **REST API**: どこからでもアクセス可能な公開API
- 💳 **決済統合**: Stripe決済を標準搭載

## 🛠️ 技術スタック

### フロントエンド
- **Framework**: Vite + SolidJS
- **UI**: ChatGPT風のチャットインターフェース
- **認証**: Google/LINE OAuth

### バックエンド
- **Platform**: Cloudflare Workers
- **Framework**: Hono
- **AI**: LangGraph (Manus風の万能エージェント)
- **Database**: PostgreSQL + Prisma
- **Payment**: Stripe

## 🏗️ アーキテクチャ方針

### システム構成

```
┌──────────────────────────────────────────────────────────┐
│  AIサービス (ai-service.example.com)                      │
│  - フロントエンド: Vite + SolidJS                          │
│  - バックエンド: Cloudflare Workers + Hono                │
│  - 認証: Google/LINE OAuth                                │
│  - AI: LangGraph Agent                                    │
└─────────────────┬────────────────────────────────────────┘
                  │ JWT Token
                  ▼
┌──────────────────────────────────────────────────────────┐
│  MCPサーバー (mcp-api.example.com)                        │
│  - バックエンド: Cloudflare Workers + Hono                │
│  - 認証: 独自Google OAuth + AIサービストークン検証         │
│  - ツール: 予約/物販/フォーム等                            │
└──────────────────────────────────────────────────────────┘
```

### 認証アーキテクチャ (OAuth 2.1 実装済み)

#### 1. エンドユーザー認証
- **対象**: エンドユーザー
- **方式**: OAuth 2.1 + PKCE
- **プロバイダー**: Google OAuth 2.0
- **管理**: JWT Access Token + Refresh Token
- **機能**: 
  - ユーザー認証・セッション管理
  - トークンのリフレッシュ
  - AI会話の管理

#### 2. MCPサーバー間通信
- **配置**: 別のCloudflare Workersプロジェクト (`packages/mcp-server`)
- **ドメイン**: 独立したドメイン/サブドメイン
- **認証方式**:
  - OAuth 2.1 Access Token検証
  - JWTベースの認証
- **機能**:
  - ビジネスツールの提供
  - データ管理
  - REST API公開

### デプロイメント戦略

#### AIサービス
- **プロジェクト**: `packages/agent`
- **デプロイ**: Cloudflare Workers
- **ドメイン**: `ai-service.example.com`
- **機能**: 
  - フロントエンド配信
  - ユーザー認証
  - AI処理
  - 決済処理

#### MCPサーバー
- **プロジェクト**: `packages/mcp-server` (新規作成予定)
- **デプロイ**: Cloudflare Workers (別プロジェクト)
- **ドメイン**: `mcp-api.example.com`
- **機能**:
  - ビジネスツールAPI
  - 管理者向け機能
  - データストレージ

### データベース設計
- **共通**: PostgreSQL + Prisma
- **AIサービステーブル**: ユーザー、セッション、会話履歴、トークン
- **MCPサーバーテーブル**: サービス、予約、商品、注文、フォーム、MCP管理者

## 🔐 セキュリティ設計

### トークンベース認証
- **形式**: JWT (JSON Web Token)
- **署名**: RSA鍵ペア
- **有効期限**: 1時間(短期)
- **スコープ**: 最小権限の原則

### 認証フロー (実装済み)

#### OAuth 2.1 + PKCE フロー
1. ユーザーがログインボタンをクリック
2. PKCE Challenge生成
3. Google認証ページへリダイレクト
4. ユーザーが認証を許可
5. コールバックでAuthorization Code取得
6. Code VerifierでAccess Token取得
7. JWTトークンでAPI通信

## 📦 提供ツール

### 1. 予約システム (Booking Tool)
- 予約枠管理
- 予約作成・キャンセル
- 空き状況検索
- カレンダー表示

### 2. 物販システム (Product Tool)
- 商品管理
- 在庫管理
- 注文処理
- Stripe決済連携

### 3. フォームシステム (Form Tool)
- フォーム作成
- 回答収集
- データ分析
- エクスポート機能

### 4. 将来の拡張
- イベント管理
- メンバーシップ
- サブスクリプション
- コンテンツ管理

## 🚀 開発ロードマップ

### Phase 1: 基盤構築 ✅ 完了
- [x] フロントエンド基本UI (Vite + SolidJS)
- [x] AIサービス認証 (OAuth 2.1実装)
- [x] 基本的なAPI構造
- [x] データベーススキーマ設計
- [x] Stripe決済統合

### Phase 2: OAuth 2.1 統合 ✅ 完了
- [x] OAuth 2.1認証フロー実装
- [x] PKCE対応
- [x] トークン管理システム
- [x] MCPサーバー認証統合
- [x] レガシー認証の削除

### Phase 3: AI エージェント実装 🚧 進行中
- [x] OpenAI統合
- [x] チャットモード
- [x] エージェントモード
- [x] ツール実行基盤
- [ ] 会話履歴の永続化
- [ ] コンテキスト管理の強化

### Phase 4: ビジネスツール実装 📋 計画中
- [ ] 予約システム完成
- [ ] 物販システム完成
- [ ] フォームシステム完成
- [ ] データベース統合

### Phase 5: 公開準備 🔮 未着手
- [ ] パフォーマンス最適化
- [ ] セキュリティ監査
- [ ] ドキュメント整備
- [ ] 本番デプロイ

## 📚 関連ドキュメント

### アーキテクチャ
- [アーキテクチャ概要](../architecture/ARCHITECTURE.md)
- [OAuth 2.1 分離アーキテクチャ](../architecture/SEPARATION_ARCHITECTURE_OAUTH2.md)

### 実装ガイド
- [OAuth 2.1 認証統合](../guides/MCP_AUTH_OAUTH2.md)
- [AI統合ガイド](../guides/AI_INTEGRATION.md)
- [決済統合](../guides/PAYMENT_INTEGRATION.md)
- [クイックスタート](../guides/QUICKSTART.md)

### 実装レポート
- [認証実装報告](../reports/AUTH_IMPLEMENTATION.md)
- [アーキテクチャ修正](../reports/ARCHITECTURE_CORRECTION.md)
- [実装サマリー](../reports/SUMMARY.md)