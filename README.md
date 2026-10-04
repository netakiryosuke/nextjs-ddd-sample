# nextjs-ddd-sample

催事予約を題材に、Next.jsでDDD指向のレイヤードアーキテクチャを実践するサンプルです。
現在はNext.jsのひな型・初期ページ、催事予約のDomain層、DB定義・Repositoryと取得系Application Serviceを実装しています。

## 技術構成

- Next.js 16 / React 19
- TypeScript（strictモード）
- Zod 4（Domainの属性検証）
- PostgreSQL 18 / Prisma 7
- App Router / `src/`構成
- Tailwind CSS 4
- ESLint
- npm

## 起動

Node.js 20系は20.19以上、22系は22.12以上、24系以降に対応します。動作確認にはNode.js 24を使っています。

```bash
npm ci
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

## DBの準備

DockerとDocker Composeを使います。

```bash
npm run db:up
npm run db:migrate
npm run db:generate
```

PostgreSQLは `127.0.0.1:55432` で起動します。DB名は `event_reservation`、ローカル開発用のユーザー名・パスワードはどちらも `ddd` です。
Prisma CLIの接続先は `prisma.config.ts` に定義し、環境変数 `DATABASE_URL` で変更できます。
停止する場合は `npm run db:stop` を実行します。DBのデータはDocker Volumeに保持します。

DB構造の正典は `prisma/migrations/` 以下のSQLです。現在は [0_init/migration.sql](./prisma/migrations/0_init/migration.sql) の1つにまとめ、Prisma Migrateで適用します。
[prisma/schema.prisma](./prisma/schema.prisma) はPrisma用のマッピングとしてSQLと同期させます。CHECK制約と部分一意索引はMigrationのSQLに定義します。
Prisma Clientの生成先は `src/infrastructure/generated/prisma/` とし、生成コードはGitに含めません。

リリース前の学習用としてMigrationは初回の1つにまとめ、変更時にはSchemaと初回Migrationを直接修正します。
適用済みのDBには、ファイルの編集だけで変更が反映されるわけではありません。新しいDB・スキーマへ初期適用して確認します。
リリースする段階からは適用済みのMigrationを固定し、変更を新しいMigrationとして追加します。

リリース後のフォルダ構成、変更用SQLの書き方、Prismaが適用履歴を管理する仕組みは [DB Migrationの運用](./docs/database-migrations.md) を参照してください。

## 検証

```bash
npm test
npm run db:validate
npm run lint
npm run typecheck
npm run build
```

DomainとApplicationの単体テストはNode.js標準のテストランナーとtsxを使い、Next.jsやDBを起動せずに実行します。ApplicationではRepositoryのStubを使い、テストごとに前提データを定義します。

DB定義のテストは、PostgreSQLを起動してから実行します。

```bash
npm run db:up
npm run test:db
```

Next.jsにはテスト時にMigrationを自動実行する標準ディレクトリはありません。
[tests/support/createTestDatabase.ts](./tests/support/createTestDatabase.ts) が、Node.jsの `before` フックから次の準備を行います。

1. テスト専用の新しいPostgreSQLスキーマを作る。
2. そのスキーマに `prisma migrate deploy` でMigrationを適用し、Prismaが表現できる構造についてSchemaとの差分がないことを確認する。
3. 各テストのデータをスイート内で初期化し、終了時にテスト専用スキーマを削除する。

開発用の `public` スキーマのデータはテストから操作しません。初回Migrationを直接編集しても、毎回新しいスキーマで検証できます。
テストの接続先は環境変数 `TEST_DATABASE_URL` で変更できます。指定がなければ、Composeで起動したローカルDBを使います。
Repositoryのテストは実装クラスごとに1ファイルに分け、実DBを使って取得・保存・条件検索とDomain Entityへの復元を確認します。DAOはRepository経由で検証します。テストデータの定義・INSERTは各テストメソッド内に記述し、共通ヘルパーは `tests/support/createTestDatabase.ts` にまとめ、SQL接続・Prisma Client・Migration・後片付けを担当します。

本番ビルドを起動する場合は、ビルド後に `npm start` を実行します。

## アーキテクチャ

[AGENTS.md](./AGENTS.md) に従い、以下の責務で実装します。
現在はPresentation・Domain層、取得系Application Serviceと、DB定義・Repository・DBテストまで実装しています。予約・キャンセルと画面からの呼び出しは次の段階で追加します。

| ディレクトリ | 責務 |
| --- | --- |
| `src/app/` | Presentation：ページ、Server Actions、UI |
| `src/application/` | Application：ユースケースの調整 |
| `src/domain/` | Domain：業務モデルとルール |
| `src/infrastructure/` | Infrastructure：永続化などの技術的な実装 |

import aliasは `@/*` → `src/*` です。

Domain層では、`Event`・`EventAvailability`・`Reservation`・`Venue`、開催期間のValue Objectである `EventPeriod` と、各Repositoryのインターフェースを定義しています。
日時には内部保持も含めて `Date` を使い、現在時刻は呼び出し元から明示的に渡します。保持・取得時には値をコピーして、日時の書き換えによる状態変更を防ぎます。
`src/instrumentation.ts` の `register` で、Next.jsのNode.jsサーバー起動時に `TZ=Asia/Tokyo` を設定します。開発・本番ともに適用され、npmを経由しないstandaloneサーバーでもJSTを使います。Next.jsを起動しない `test`・`test:db` のnpmスクリプトには同じTZを設定しています。ブラウザ側の表示でも `Asia/Tokyo` を明示します。DBは `TIMESTAMPTZ(3)` で同じ時点を保持します。

## Applicationの取得系

`src/application/event/EventApplicationService.ts` に一覧・詳細の取得をまとめます。RepositoryはDomainのインターフェースをコンストラクタで注入します。

- `list(): Promise<Event[]>`：催事一覧を返します。
- `lookup(eventId): Promise<EventAvailability | null>`：催事の空き状況を返します。催事が存在しない場合は `null` を返します。

本人の予約状況の取得は別ユースケースであり、今回は実装しません。表示用フォーマットとClient Componentへ渡すplain objectへの変換はPresentationで行います。

## Infrastructureの構成

Infrastructureは技術的な責務で分けます。Repository実装は直下に置き、ネイティブSQLのDAOと取得結果DTOを `dao/`・`dto/` に置きます。

```text
src/infrastructure/
├─ dao/
│  ├─ EventDao.ts
│  └─ EventAvailabilityDao.ts
├─ dto/
│  ├─ EventDto.ts
│  └─ EventAvailabilityDto.ts
├─ db/
│  └─ prismaClient.ts
├─ generated/prisma/
├─ PrismaEventRepository.ts
├─ PrismaEventAvailabilityRepository.ts
├─ PrismaReservationRepository.ts
└─ PrismaVenueRepository.ts
```

DAOは `selectById`・`selectAll` でDTOを返し、RepositoryがコンストラクタでDomain Entityへ復元します。
`Event`・`EventAvailability` の取得は、催事と会場のJOIN、必要なら有効予約数の相関サブクエリを含むSQL1本で行います。
SQLはDAOの各メソッド内に全文を記述し、`$queryRaw` と `Prisma.sql` で値をパラメータとして渡します。共通のSQL断片へ切り出しません。
`$queryRaw` はSQLから結果型を生成せず、型指定がなければ `unknown` を返します。JOIN・集計結果の構造をDTOとして明示し、RepositoryでDomain Entityへ変換します。指定した型とSQLの整合性は、RepositoryのDBテストで確認します。

会場・予約の操作と催事の保存は、Prismaの標準APIをRepository内で直接使います。これらの取得結果にはPrismaの生成型が付くため、専用DAO・DTOは作りません。戻り値はplain objectであり、Domain Entityの生成はRepositoryの各メソッド内で行います。
各 `save` はINSERTまたはUPDATEを行い、保存したDomain Entityを返します。催事の保存で会場や予約のレコードは更新しません。
Repository実装は `implements` でDomainのインターフェースを実装します。`override` は基底クラスのメソッドを上書きするときの修飾子であり、インターフェースの実装には付けません。
`Reservation` は公開コンストラクタで生成・復元し、属性と状態の整合性を検証します。新規予約では予約中・キャンセル日時なしを指定し、DBからの復元では保存済みの状態・日時を指定します。

共通Clientは `db/prismaClient.ts` が提供し、開発時はホットリロードによる接続増加を防ぐためインスタンスを再利用します。
接続URLの `schema` を標準APIとネイティブSQLで揃えます。
DAO・Repositoryにはトランザクション中のClientも渡せます。Applicationのトランザクション抽象と催事行ロックは、ユースケース実装時に追加します。

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

## 依存パッケージの補正

Prisma 7.10のCLI依存に含まれる `deepmerge-ts` と `mysql2` は、既知の脆弱性が修正されたバージョンへ `package.json` の `overrides` で差し替えています。
Prismaを更新する際は、差し替えが引き続き必要か確認します。

## モデリング

- [ユビキタス言語](./docs/ubiquitous-language.md)
- [ドメインモデル・集約の境界](./docs/domain-model.md)
- [ERD](./docs/ERD.md)
- [ユースケース図](./docs/usecase.md)
