# nextjs-ddd-sample

催事予約を題材に、Next.jsでDDD指向のレイヤードアーキテクチャを実践するサンプルです。
現在はNext.jsのひな型・初期ページと、催事予約のDomain層を実装しています。

## 技術構成

- Next.js 16 / React 19
- TypeScript（strictモード）
- Zod 4（Domainの属性検証）
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
npm test
npm run lint
npm run typecheck
npm run build
```

Domainの単体テストはNode.js標準のテストランナーとtsxを使い、Next.jsやDBを起動せずに実行します。

本番ビルドを起動する場合は、ビルド後に `npm start` を実行します。

## アーキテクチャ

[AGENTS.md](./AGENTS.md) に従い、以下の責務で実装します。
現在は `src/app/` と `src/domain/` を作成済みです。ほかの層は業務機能の実装に合わせて追加します。

| ディレクトリ | 責務 |
| --- | --- |
| `src/app/` | Presentation：ページ、Server Actions、UI |
| `src/application/` | Application：ユースケースの調整 |
| `src/domain/` | Domain：業務モデルとルール |
| `src/infrastructure/` | Infrastructure：永続化などの技術的な実装 |

import aliasは `@/*` → `src/*` です。

Domain層では、`Event`・`EventAvailability`・`Reservation`・`Venue`、開催期間のValue Objectである `EventPeriod` と、各Repositoryのインターフェースを定義しています。
日時には `Date` を使い、現在時刻は呼び出し元から明示的に渡します。保持・取得時には値をコピーして、日時の書き換えによる状態変更を防ぎます。

## Domainの属性検証

各モデルと同じファイルにZodのスキーマを定義し、コンストラクタで属性をまとめて検証します。生成とDBからの復元が同じ検証を通ります。
スキーマ名は `eventSchema` のように `<entityName>Schema` とし、モデルには `parse` の戻り値を保持します。`trim` などの変換を追加した場合も、変換後の値が反映されます。
Bean Validationのように属性ごとの制約を宣言できますが、検証の実行には明示的な `parse` の呼び出しが必要です。

| 対象 | Zodの制約 |
| --- | --- |
| 定員 | `z.number().int().positive()` |
| 予約数 | `z.number().int().nonnegative()` |
| 日時 | `z.date()`（無効なDateを拒否） |
| 予約状態 | `z.enum(ReservationStatus)` |

`parse` が失敗すると `ZodError` が投げられ、`issues` に各フィールドのパスと理由が入ります。例外を投げずに結果を分岐したい場合は `safeParse` を使えます。
開始・終了の前後関係、予約状態とキャンセル日時の整合性、操作時の業務条件は、モデル内の条件式とメソッドで表現します。
専用の業務例外クラスは、ユースケースで区別すべき失敗が明確になった時点で導入します。

## モデリング

- [ユビキタス言語](./docs/ubiquitous-language.md)
- [ドメインモデル・集約の境界](./docs/domain-model.md)
- [ERD](./docs/ERD.md)
- [ユースケース図](./docs/usecase.md)
