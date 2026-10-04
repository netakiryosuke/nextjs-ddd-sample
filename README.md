# nextjs-ddd-sample

催事予約を題材に、Next.jsでDDD指向のレイヤードアーキテクチャを実践するサンプルです。
現在は催事一覧・詳細画面、催事予約のDomain層、DB定義・Repositoryと取得系Application Serviceを実装しています。

## 技術構成

- Next.js 16 / React 19
- TypeScript（strictモード）
- Zod 4（Domainの属性検証）
- PostgreSQL 18 / Prisma 7
- InversifyJS 8（DIコンテナ）
- App Router / `src/`構成
- Tailwind CSS 4
- ESLint
- npm

## 起動

### Docker ComposeでアプリとDBを起動する

DockerとDocker Composeを使います。ホストへのNode.jsのインストールは不要です。

```bash
docker compose up -d --build --wait
```

[http://localhost:3100](http://localhost:3100) を開いてください。

| Service | 役割 |
| --- | --- |
| `postgres` | PostgreSQL。正常起動をhealthcheckで確認する |
| `migrate` | Prisma Migrateを実行して終了する |
| `app` | Migration完了後にNext.jsのstandaloneサーバーを起動する |

`Dockerfile` は依存のインストール、Migration用、アプリのビルド、実行用のステージを分けています。
実行用にはstandalone出力と静的ファイルをコピーし、Node.js 24・一般ユーザーで起動します。コンテナのタイムゾーンは `Asia/Tokyo` です。
DB接続先はComposeのサービス名 `postgres` を使います。アプリのhealthcheckでは一覧ページへのHTTP応答とDBからの取得を確認します。
`.env` 系ファイルはDockerのビルド対象から除外しています。

ソース変更後は同じ起動コマンドで再ビルドしてください。自動リロードを使う場合は、下記のホストでの開発方法を使います。

```bash
docker compose logs -f app
docker compose ps -a
docker compose stop
```

停止してもDBのデータはVolumeに保持します。ダミーデータの投入方法は下記の「ダミーデータ」を参照してください。自動投入はせず、DBが空なら一覧には案内が表示されます。
npmからは `npm run compose:up`・`npm run compose:stop` でも操作できます。

アプリは `http://localhost:3100`、ホストからDBは `localhost:55433` で利用します。
Composeのポート指定は `3100:3000`・`55433:5432` とし、全インターフェースに公開します。コンテナ間のDB接続先は `postgres:5432` です。

### ホストで開発する

Node.js 20系は20.19以上、22系は22.12以上、24系以降に対応します。動作確認にはNode.js 24を使っています。

```bash
npm ci
npm run db:up
npm run db:migrate
npm run db:generate
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

PostgreSQLは `localhost:55433` で起動します。DB名は `event_reservation`、ローカル開発用のユーザー名・パスワードはどちらも `ddd` です。
Prisma CLIの接続先は `prisma.config.ts` に定義し、環境変数 `DATABASE_URL` で変更できます。
`db:up`・`db:stop` はDBだけを操作します。停止する場合は `npm run db:stop` を実行します。DBのデータはDocker Volumeに保持します。

DB構造の正典は `prisma/migrations/` 以下のSQLです。現在は [0_init/migration.sql](./prisma/migrations/0_init/migration.sql) の1つにまとめ、Prisma Migrateで適用します。
[prisma/schema.prisma](./prisma/schema.prisma) はPrisma用のマッピングとしてSQLと同期させます。CHECK制約と部分一意索引はMigrationのSQLに定義します。
Prisma Clientの生成先は `src/infrastructure/generated/prisma/` とし、生成コードはGitに含めません。

リリース前の学習用としてMigrationは初回の1つにまとめ、変更時にはSchemaと初回Migrationを直接修正します。
適用済みのDBには、ファイルの編集だけで変更が反映されるわけではありません。新しいDB・スキーマへ初期適用して確認します。
リリースする段階からは適用済みのMigrationを固定し、変更を新しいMigrationとして追加します。

リリース後のフォルダ構成、変更用SQLの書き方、Prismaが適用履歴を管理する仕組みは [DB Migrationの運用](./docs/database-migrations.md) を参照してください。

## ダミーデータ

テーブル定義のMigrationと、画面確認用のseedを分けます。
`prisma/seed.sql` を `prisma.config.ts` の `migrations.seed` に登録し、Prismaのseedコマンドから実行します。Prisma 7ではMigration時にseedは自動実行されません。

ComposeでDB・アプリを起動した後、次のコマンドで投入できます。

```bash
docker compose build migrate
docker compose run --rm migrate npm run db:seed
```

ホストに依存パッケージをインストール済みの場合は `npm run db:seed` でも同じデータを投入できます。

| 催事 | 開催日時（初回投入日の日本時間が基準） | 定員 | 有効予約数 | 残席 | 表示 |
| --- | --- | --- | --- | --- | --- |
| はじめての陶芸ワークショップ | 翌日10:00〜12:00 | 5人 | 2人 | 3席 | 空席あり |
| 少人数で楽しむコーヒー講座 | 2日後14:00〜16:00 | 2人 | 2人 | 0席 | 満席 |
| 街歩き写真ワークショップ | 前日10:00〜12:00 | 4人 | 1人 | 3席 | 受付終了 |

会場2件、催事3件、予約6件を用意します。陶芸のキャンセル済み予約1件は、有効予約数に含まれません。
固定IDと `ON CONFLICT DO NOTHING` により再実行しても重複せず、既存データを上書きしません。開催日時も初回投入時のままなので、日が経つと催事の受付は終了します。
seedはDBテストには使わず、各テストのデータ投入はテスト内で行います。
仕組みは [Prisma公式：Seeding](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding) を参照してください。

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
現在は一覧・詳細のPresentation、Domain層、取得系Application Serviceと、DB定義・Repository・DBテストまで実装しています。予約・キャンセルは次の段階で追加します。

| ディレクトリ | 責務 |
| --- | --- |
| `src/app/` | Presentation：ページ、Server Actions、UI |
| `src/application/` | Application：ユースケースの調整 |
| `src/domain/` | Domain：業務モデルとルール |
| `src/infrastructure/` | Infrastructure：永続化などの技術的な実装 |
| `src/di/` | 各レイヤの外側で依存を登録・解決する設定 |

import aliasは `@/*` → `src/*` です。

Domain層では、`Event`・`EventAvailability`・`Reservation`・`Venue`、開催期間のValue Objectである `EventPeriod` と、各Repositoryのインターフェースを定義しています。
日時には内部保持も含めて `Date` を使い、現在時刻は呼び出し元から明示的に渡します。保持・取得時には値をコピーして、日時の書き換えによる状態変更を防ぎます。
`src/instrumentation.ts` の `register` で、Next.jsのNode.jsサーバー起動時に `TZ=Asia/Tokyo` を設定します。開発・本番ともに適用され、npmを経由しないstandaloneサーバーでもJSTを使います。Next.jsを起動しない `test`・`test:db` のnpmスクリプトには同じTZを設定しています。ブラウザ側の表示でも `Asia/Tokyo` を明示します。DBは `TIMESTAMPTZ(3)` で同じ時点を保持します。

## Applicationの取得系

`src/application/event/EventApplicationService.ts` に一覧・詳細の取得をまとめます。RepositoryはDomainのインターフェースをコンストラクタで注入します。

- `list(): Promise<Event[]>`：催事一覧を返します。
- `lookup(eventId): Promise<EventAvailability | null>`：催事の空き状況を返します。催事が存在しない場合は `null` を返します。

本人の予約状況の取得は別ユースケースであり、今回は実装しません。表示用フォーマットとClient Componentへ渡すplain objectへの変換はPresentationで行います。

## Presentationの取得系

| URL | 表示内容 |
| --- | --- |
| `/` | 催事一覧：開催日時・会場名・定員、詳細へのリンク |
| `/events/[eventId]` | 催事詳細：開催情報・有効予約数・残席・受付状態 |

どちらもServer ComponentでDIコンテナから `EventApplicationService` を取得し、`list`・`lookup` を直接呼び出します。
`connection()` でリクエスト時にDBを参照するため、ビルド時にDB接続は不要です。日時はPresentationの `Intl.DateTimeFormat` で日本時間に整形します。
詳細の受付状態と残席はDomainのメソッドを使って判定します。自分の予約状況や予約・キャンセル操作は含めません。

一覧が空の場合は案内を表示し、存在しない催事は `notFound()` で扱います。取得エラーは `error.tsx` に案内と再試行ボタンを表示します。
画面を利用する前にDBの準備を行ってください。初期データの自動投入はなく、データがなければ空の一覧になります。
描画タイミングの指定は [Next.js公式：connection](https://nextjs.org/docs/app/api-reference/functions/connection) を参照してください。

## Dependency Injection

InversifyJSでService・Repository・DAOを登録し、コンテナ内のsingletonとして共有します。
`src/di/createContainer.ts` に依存関係を集約し、`src/di/container.ts` が既存の共通Prisma Clientを使ってサーバー用コンテナを生成します。interfaceは実行時に存在しないため、Repositoryの識別には `src/di/tokens.ts` のSymbolを使います。

`toResolvedValue` でコンストラクタ引数の解決をコンテナに任せます。Application・DomainやRepository実装にDIデコレータを付けず、DIライブラリへの依存は `src/di/` に閉じ込めます。
PresentationのServer Component・Server Actionでは、利用するApplication Serviceを指定して取得します。

```ts
import { EventApplicationService } from "@/application/event/EventApplicationService";
import { container } from "@/di/container";

const eventApplicationService = container.get(EventApplicationService);
```

`src/di/container.ts` は `server-only` でClient Componentからのimportを防ぎます。
Next.jsのNode.js起動時に `src/instrumentation.ts` で `EventApplicationService` を解決し、その依存関係の登録漏れ・複数候補をリクエスト受付前に検出します。新しいApplication Serviceを追加した際は、この起動時の検証対象にも追加します。
重複登録は登録時には許容されますが、単一の依存を解決するときに複数候補があればエラーになります。

singletonの共有範囲はコンテナ内です。別プロセス・別コンテナ間では共有しません。開発時にDIモジュールが再読み込みされるとコンテナは再生成されますが、Prisma Clientは既存の仕組みで再利用します。
ユーザー情報やトランザクション中のClientを共有singletonへ保存せず、ユースケースの実行単位で扱います。

DIのテストは実DBに接続せず、singletonの共有、ServiceからRepository・DAOまでの注入、登録漏れ・複数候補の検出を確認します。
登録APIは [InversifyJS公式ドキュメント](https://inversify.io/docs/api/binding-syntax/) を参照してください。

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
