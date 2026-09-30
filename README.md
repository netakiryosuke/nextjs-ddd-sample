# nextjs-ddd-sample

催事予約を題材に、Next.jsでDDD指向のレイヤードアーキテクチャを実践するサンプルです。
現在はNext.jsのひな型と初期ページまで実装しています。

## 技術構成

- Next.js 16 / React 19
- TypeScript（strictモード）
- App Router / `src/`構成
- Tailwind CSS 4
- ESLint
- npm

## 起動

Node.js 20.9以上が必要です。初期構築時はNode.js 24で動作を確認しています。

```bash
npm ci
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

## 検証

```bash
npm run lint
npm run typecheck
npm run build
```

本番ビルドを起動する場合は、ビルド後に `npm start` を実行します。

## アーキテクチャ

[AGENTS.md](./AGENTS.md) に従い、以下の責務で実装します。
現在は `src/app/` のみ作成済みです。ほかの層は業務機能の実装に合わせて追加します。

| ディレクトリ | 責務 |
| --- | --- |
| `src/app/` | Presentation：ページ、Server Actions、UI |
| `src/application/` | Application：ユースケースの調整 |
| `src/domain/` | Domain：業務モデルとルール |
| `src/infrastructure/` | Infrastructure：永続化などの技術的な実装 |

import aliasは `@/*` → `src/*` です。
