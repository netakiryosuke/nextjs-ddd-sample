# nextjs-ddd-sample

催事予約を題材に、Next.jsでDDD指向のレイヤードアーキテクチャを実践するサンプルです。
現在は催事一覧・詳細画面、予約・キャンセル操作、Domain層、DB定義・RepositoryとApplication Serviceを実装しています。

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

[http://localhost:3000/events](http://localhost:3000/events) を開いてください。

| Service | 役割 |
| --- | --- |
| `postgres` | PostgreSQL。正常起動をhealthcheckで確認する |
| `migrate` | Prisma Migrateを実行して終了する |
| `app` | Migration完了後にNext.jsのstandaloneサーバーを起動する |
| `keycloak` | 開発用IdP。初回起動時にRealmとテストユーザーを取り込む |
| `keycloak-postgres` | Keycloak専用のPostgreSQL。ホストへのポート公開なし |

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

アプリは `http://localhost:3000`、ホストからDBは `localhost:5432` で利用します。
アプリはコンテナ内でも `3000`、DBは `5432` で待ち受けます。Composeのポート指定は `3000:3000`・`5432:5432` とし、全インターフェースに公開します。コンテナ間のDB接続先は `postgres:5432` です。

### ホストで開発する

Node.js 20系は20.19以上、22系は22.12以上、24系以降に対応します。動作確認にはNode.js 24を使っています。

```bash
npm ci
npm run db:up
npm run db:migrate
npm run db:generate
npm run dev
```

[http://localhost:3000/events](http://localhost:3000/events) を開いてください。

## DBの準備

DockerとDocker Composeを使います。

```bash
npm run db:up
npm run db:migrate
npm run db:generate
```

PostgreSQLは `localhost:5432` で起動します。DB名は `event_reservation`、ローカル開発用のユーザー名・パスワードはどちらも `ddd` です。
Prisma CLIの接続先は `prisma.config.ts` に定義し、環境変数 `DATABASE_URL` で変更できます。
`db:up`・`db:stop` はDBだけを操作します。停止する場合は `npm run db:stop` を実行します。DBのデータはDocker Volumeに保持します。

DB構造の正典は `prisma/migrations/` 以下のSQLです。現在は [0_init/migration.sql](./prisma/migrations/0_init/migration.sql) の1つにまとめ、Prisma Migrateで適用します。
[prisma/schema.prisma](./prisma/schema.prisma) はPrisma用のマッピングとしてSQLと同期させます。CHECK制約と部分一意索引はMigrationのSQLに定義します。
Prisma Clientの生成先は `src/infrastructure/generated/prisma/` とし、生成コードはGitに含めません。

リリース前の学習用としてMigrationは初回の1つにまとめ、変更時にはSchemaと初回Migrationを直接修正します。
適用済みのDBには、ファイルの編集だけで変更が反映されるわけではありません。新しいDB・スキーマへ初期適用して確認します。
リリースする段階からは適用済みのMigrationを固定し、変更を新しいMigrationとして追加します。

リリース後のフォルダ構成、変更用SQLの書き方、Prismaが適用履歴を管理する仕組みは [DB Migrationの運用](./docs/database-migrations.md) を参照してください。

## Keycloak

`../spring-security-keycloak` のCompose設定とrealm定義をもとに、Realm `my-app` とテストユーザー2件を流用しています。元のリポジトリへの実行時依存はありません。Keycloakのバージョンは元のexportと同じ `26.6.2` に固定しています。

Keycloakだけを起動する場合は次を実行します。全サービスの起動コマンドでも起動します。

```bash
docker compose up -d --wait keycloak
```

管理コンソールは [http://localhost:8080/admin](http://localhost:8080/admin) です。

| 用途 | Realm | ユーザー名 | パスワード |
| --- | --- | --- | --- |
| Keycloak管理 | `master` | `admin` | `admin` |
| 一般利用者 | `my-app` | `user` | `pass` |
| 管理者ロールを持つ利用者 | `my-app` | `admin` | `pass` |

`my-app` の利用者には元のUUIDとパスワードハッシュを引き継ぎます。一般利用者は `USER`、管理者は `USER`・`ADMIN` のRealm Roleを持ちます。アプリ側のロールによる制御はまだ実装していません。

Auth.js接続用にConfidential Client `nextjs-client` を用意します。

| 設定 | 値 |
| --- | --- |
| Client ID | `nextjs-client` |
| Client Secret | `demo-nextjs-client-secret` |
| Callback URL | `http://localhost:3000/api/auth/callback/keycloak` |
| Flow | Authorization Code / PKCE S256 |
| Issuer | `http://localhost:8080/realms/my-app` |
| ホストからのDiscovery URL | `http://localhost:8080/realms/my-app/.well-known/openid-configuration` |
| コンテナ間のDiscovery URL | `http://keycloak:8080/realms/my-app/.well-known/openid-configuration` |

`KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true` により、コンテナ間でDiscoveryを取得した際はToken・UserInfo・JWKSのURLに内部ホスト名を使います。Issuerとブラウザ向けのAuthorization URLは `localhost:8080` を使います。Auth.js接続時にはIssuerとDiscovery URLをこの区別に合わせて設定します。[Keycloak公式：内部URLと公開URL](https://www.keycloak.org/server/hostname)

Realm定義は `keycloak/realm-export.json` です。初回起動時に `--import-realm` で取り込みます。既存Realmはスキップされるため、JSONを編集して再起動するだけでは変更は反映されません。作成済みのRealmは管理コンソールで更新します。[Keycloak公式：Realmの起動時import](https://www.keycloak.org/server/importExport)

exportファイルは手で編集・削減せず、管理コンソールなどで設定を変更し、ログインを確認した後にCLIで再生成します。次の手順で、ユーザーを含む `my-app` の設定全体を `keycloak/realm-export.json` に上書きします。export中はKeycloakを停止し、専用DBだけを起動しておきます。

```bash
docker compose stop keycloak
docker compose up -d --wait keycloak-postgres
docker compose run --rm --no-deps \
  --volume "$PWD/keycloak:/opt/keycloak/data/export" \
  keycloak export --realm my-app \
  --file /opt/keycloak/data/export/realm-export.json
```

出力されたJSONはそのまま保持します。Keycloakを再開する場合は `docker compose up -d --wait keycloak` を実行します。

Keycloak専用DBとVolumeは、アプリ用DBとは分離しています。停止後もRealm・ユーザー・設定は保持されます。

```bash
docker compose logs -f keycloak
docker compose stop keycloak keycloak-postgres
```

`start-dev` と上記の固定資格情報はローカルのデモ用です。Auth.jsの導入とアプリからのログイン・ログアウトは次の実装で接続します。

## ダミーデータ

テーブル定義のMigrationと、画面確認用のseedを分けます。
`prisma/seed.sql` を `prisma.config.ts` の `migrations.seed` に登録し、Prismaのseedコマンドから実行します。Prisma 7ではMigration時にseedは自動実行されません。

ComposeでDB・アプリを起動した後、次のコマンドで投入できます。

```bash
docker compose build migrate
docker compose run --rm migrate npm run db:seed
```

ホストに依存パッケージをインストール済みの場合は `npm run db:seed` でも同じデータを投入できます。

日本橋三越本店の[イベントカレンダー](https://www.mistore.jp/store/nihombashi/event_calendar.html)を参考に、百貨店の食品・美術・リビングの催しを想定した架空のデータを用意します。実際の催事名・開催日程ではありません。

| 催事 | 開催日時（seed実行日の日本時間が基準） | 定員 | 有効予約数 | 残席 | 表示 |
| --- | --- | --- | --- | --- | --- |
| 産地で味わう日本茶の飲み比べセミナー | 7日後11:00〜12:00 | 12人 | 2人 | 10席 | 空席あり |
| 現代アート展 出展作家によるアーティストトーク | 8日後14:00〜15:00 | 8人 | 8人 | 0席 | 満席 |
| 季節のうつわで楽しむテーブルコーディネート講座 | 10日後13:00〜14:30 | 10人 | 1人 | 9席 | 空席あり |
| 日本画展 学芸員によるギャラリートーク | 前日14:00〜15:00 | 20人 | 1人 | 19席 | 受付終了 |

会場3件、催事4件、予約13件を用意します。日本茶セミナーのキャンセル済み予約1件は、有効予約数に含まれません。表の予約数・残席は初回投入時の値です。操作用の固定利用者とは別の利用者で予約を用意するため、空席のある催事を予約できます。
固定IDにより再実行しても重複しません。seed対象の会場名と催事の開催情報は上書きし、開催日時を実行日基準に更新します。既存の予約履歴は上書き・削除しません。
開催日時は自動では更新されません。日が経って受付終了になった場合はseedを再実行してください。seed対象以外の会場・催事は変更しません。
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
現在は一覧・詳細のPresentation、予約・キャンセルのServer Action、Domain層、取得・予約・キャンセルのApplication Serviceと、DB定義・Repository・トランザクションの実装まで用意しています。認証と本人の予約状況取得は今後追加します。

| ディレクトリ | 責務 |
| --- | --- |
| `src/app/` | Presentation：ページ、Server Actions、UI |
| `src/application/` | Application：ユースケースの調整 |
| `src/domain/` | Domain：業務モデルとルール |
| `src/infrastructure/` | Infrastructure：永続化などの技術的な実装 |
| `src/di/` | 各レイヤの外側で依存を登録・解決する設定 |

import aliasは `@/*` → `src/*` です。

Domain層では、`Event`・`EventAvailability`・`Reservation`・`Venue`、開催期間のValue Objectである `EventPeriod` と、各Repositoryのインターフェースを定義しています。
Entityは不変として扱い、状態変更のメソッドは変更後の新しいEntityを返します。`Reservation.cancel` の戻り値をApplication Serviceで保存し、取得した元のEntityは変更しません。
日時には内部保持も含めて `Date` を使い、現在時刻は呼び出し元から明示的に渡します。保持・取得時には値をコピーして、日時の書き換えによる状態変更を防ぎます。
`src/instrumentation.ts` の `register` で、Next.jsのNode.jsサーバー起動時に `TZ=Asia/Tokyo` を設定します。開発・本番ともに適用され、npmを経由しないstandaloneサーバーでもJSTを使います。Next.jsを起動しない `test`・`test:db` のnpmスクリプトには同じTZを設定しています。ブラウザ側の表示でも `Asia/Tokyo` を明示します。DBは `TIMESTAMPTZ(3)` で同じ時点を保持します。

## Applicationの取得系

Application層はドメイン別のディレクトリに分けず、Service・トランザクション抽象・テストを `src/application/` 直下に配置します。NotFound系の例外は、それぞれ `src/domain/event/`・`src/domain/reservation/` に定義します。

`src/application/EventApplicationService.ts` に一覧・詳細の取得をまとめます。RepositoryはDomainのインターフェースをコンストラクタで注入します。

- `list(): Promise<Event[]>`：催事一覧を返します。
- `lookup(eventId): Promise<EventAvailability | null>`：催事の空き状況を返します。催事が存在しない場合は `null` を返します。

本人の予約状況の取得は別ユースケースであり、今回は実装しません。表示用フォーマットとClient Componentへ渡すplain objectへの変換はPresentationで行います。

## Applicationの更新系

`src/application/ReservationApplicationService.ts` に予約・キャンセルをまとめます。

- `reserve(eventId, userId): Promise<Reservation>`：開始前・空席あり・本人の有効予約なしを確認して、新しい予約を保存します。
- `cancel(reservationId, userId): Promise<Reservation>`：開始前・本人・有効な予約であることを確認し、キャンセル日時と状態を保存します。

Application層の共通抽象 `TransactionManager.execute(operation)` を使い、Infrastructure層の `PrismaTransactionManager` がトランザクションを管理します。Application Serviceには各Repositoryを個別に注入し、引数なしの非同期コールバック内で使用します。`EventRepository.findByIdForUpdate` で催事を取得して行ロックし、その後に集計・予約を読み込むことで、同時予約による定員超過や重複予約を防ぎます。現在時刻もロック取得とデータ取得の後に決めます。

`TransactionManager` は催事や予約、Repositoryの型に依存しません。会場・催事の保存など、他の更新処理にも利用できます。現在は `execute` の入れ子を明示的に拒否します。コールバック内のDB操作はすべてawaitし、処理をコールバック外へ持ち越さないようにします。
キャンセル済みの予約は保存し、再予約では新しいIDを作ります。業務上の拒否と対象が存在しない場合は具体的な例外クラスで伝えます。
Server Actionではデモ用の固定利用者IDを渡します。今後はAuth.jsのSessionから認証済み利用者IDを取得します。
実DBテストで同時予約・同時キャンセル・キャンセル後の再予約・ロールバックを検証します。

## Presentationの取得系

| URL | 表示内容 |
| --- | --- |
| `/` | `/events` へリダイレクト |
| `/events` | 催事一覧：開催日時・会場名・定員、詳細へのリンク |
| `/events/[eventId]` | 催事詳細：開催情報・有効予約数・残席・受付状態 |

一覧・詳細はServer ComponentでDIコンテナから `EventApplicationService` を取得し、`list`・`lookup` を直接呼び出します。
`connection()` でリクエスト時にDBを参照するため、ビルド時にDB接続は不要です。日時はPresentationの `Intl.DateTimeFormat` で日本時間に整形します。
詳細の受付状態と残席はDomainのメソッドを使って判定します。予約成功後はキャンセルボタンを表示し、キャンセル後は再予約できます。成功時には詳細画面の残席を再取得します。業務上のエラーはフォーム内に表示します。

現在は全員が同じデモ用利用者として操作します。本人の予約状況取得は未実装のため、再読み込みや画面遷移後はキャンセルボタンを復元できません。予約データはDBに残り、再度予約すると重複予約エラーになります。認証と予約状況取得の追加箇所にはTODOを記載しています。

一覧が空の場合は案内を表示し、存在しない催事は `notFound()` で扱います。取得エラーは `error.tsx` に案内と再試行ボタンを表示します。
画面を利用する前にDBの準備を行ってください。初期データの自動投入はなく、データがなければ空の一覧になります。
描画タイミングの指定は [Next.js公式：connection](https://nextjs.org/docs/app/api-reference/functions/connection) を参照してください。

## Dependency Injection

InversifyJSでService・Repository・DAOを登録し、コンテナ内のsingletonとして共有します。
`src/di/createContainer.ts` に依存関係を集約し、`src/di/container.ts` が既存の共通Prisma Clientを使ってサーバー用コンテナを生成します。interfaceは実行時に存在しないため、Repositoryの識別には `src/di/tokens.ts` のSymbolを使います。

`toResolvedValue` でコンストラクタ引数の解決をコンテナに任せます。Application・DomainやRepository実装にDIデコレータを付けず、DIライブラリへの依存は `src/di/` に閉じ込めます。
PresentationのServer Component・Server Actionでは、利用するApplication Serviceを指定して取得します。

```ts
import { EventApplicationService } from "@/application/EventApplicationService";
import { container } from "@/di/container";

const eventApplicationService = container.get(EventApplicationService);
```

`src/di/container.ts` は `server-only` でClient Componentからのimportを防ぎます。
Next.jsのNode.js起動時に `src/instrumentation.ts` で `EventApplicationService` と `ReservationApplicationService` を解決し、その依存関係の登録漏れ・複数候補をリクエスト受付前に検出します。新しいApplication Serviceを追加した際は、この起動時の検証対象にも追加します。
重複登録は登録時には許容されますが、単一の依存を解決するときに複数候補があればエラーになります。

singletonの共有範囲はコンテナ内です。別プロセス・別コンテナ間では共有しません。開発時にDIモジュールが再読み込みされるとコンテナは再生成されますが、Prisma Clientは既存の仕組みで再利用します。
ユーザー情報やトランザクション中のClientを共有singletonへ保存せず、ユースケースの実行単位で扱います。
`createTransactionalPrismaClient` で作成したProxyを、`Prisma.TransactionClient` 型でRepository・DAOへ注入します。Repository・DAOは通常のPrisma APIを使い、Providerを参照しません。Proxyは呼び出し時に `PrismaClientProvider` からClientを取得します。`AsyncLocalStorage` で実行中のTransaction Clientを共有し、トランザクション外では共通のPrisma Clientを使います。Repository・DAO自体はsingletonを維持し、並行する処理のTransaction Clientは混在しません。終了したトランザクションの非同期コンテキストからのDBアクセスは拒否します。

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
DAO・RepositoryにはPrisma ClientのProxyを注入し、通常のClientまたは実行中のTransaction Clientへの切り替えを隠蔽します。トランザクション管理は `PrismaTransactionManager`、催事行ロックは `PrismaEventRepository.findByIdForUpdate` が担当します。

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
