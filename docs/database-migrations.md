# DB Migrationの運用

## 管理するファイル

DB構造の正典は `prisma/migrations/` 内のSQLです。全Migrationを順に適用した結果が、現在のDB構造になります。
`prisma/schema.prisma` には、現在の構造に対応するPrisma用のマッピングを記述します。
CHECK制約と部分一意索引はSQLで管理します。

リリース前の学習用として、現在は `0_init/migration.sql` の1つにまとめ、変更時にはそのSQLとPrisma Schemaを直接修正します。
適用済みDBに対して、初回ファイルを編集してもSQLは再実行されません。DBテストでは毎回新しいスキーマへ初期適用して確認します。

## リリース後、次の変更はどこに書くか

**変更ごとに、新しいフォルダと、その中の `migration.sql` を追加します。**
リリース済みの `0_init/migration.sql` は保持し、以降は変更用のSQLを積み重ねます。
次は、催事タイトルを最大200文字にする場合の例です。この追加Migrationは説明用で、現在のリポジトリには作成していません。

```text
prisma/
├─ schema.prisma
└─ migrations/
   ├─ migration_lock.toml
   ├─ 0_init/
   │  └─ migration.sql
   └─ 20261003090000_change_event_title/
      └─ migration.sql
```

フォルダ名は `YYYYMMDDHHmmss_変更内容` に揃え、時系列に並ぶ名前にします。
新しい `migration.sql` には、今回の変更だけを書きます。

```sql
BEGIN;

ALTER TABLE events ALTER COLUMN title TYPE VARCHAR(200);

COMMIT;
```

このプロジェクトでの手順は次のとおりです。

1. 新しいMigrationフォルダを作り、`migration.sql` に変更用SQLを書く。
2. SQLに合わせて `prisma/schema.prisma` の `Event.title` を `String @db.VarChar(200)` に変更する。
3. `npm run db:validate` と `npm run test:db` で定義・全Migrationの適用・Schemaとの整合性を確認する。
4. `npm run db:generate` でPrisma Clientを更新する。
5. SQL・Prisma Schema・関連するコードをコミットし、対象DBに `npm run db:migrate` で適用する。

型や制約を変える際は既存データが新しい定義に適合するか確認します。
例えばタイトルが200文字を超える既存データは、そのままでは上の変更を適用できません。必要なデータ更新や `USING` による型変換もSQLに含めます。
新しいスキーマでのDBテストに加えて、既存データを含むDBでの移行確認が必要になる場合があります。

## Prismaはどう適用するか

`npm run db:migrate` の実体は `prisma migrate deploy` です。
Migrationファイルの作成は行わず、用意されたSQLのうち、対象DBに未適用のものを順に実行します。
DB内の `_prisma_migrations` テーブルに、Migration名・適用日時・SQLのチェックサムなどが記録されます。
Prismaはこの履歴から適用済みのMigrationを判断します。適用済みのファイルは編集・削除せず、変更を追加する運用にします。
（[Prisma公式：Migration histories](https://docs.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/migration-histories)、[Development and production](https://docs.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)）

上の2つのMigrationがある場合、対象DBによって実行するSQLは次のようになります。

| 対象DBの状態 | `npm run db:migrate` が実行するSQL |
| --- | --- |
| 新しいDB | `0_init` のCREATEと、追加MigrationのALTERを順に実行する |
| 初回リリース済みのDB | `0_init` は適用済みなので、追加MigrationのALTERだけ実行する |
| 追加Migrationまで適用済みのDB | 未適用のMigrationがないので何も実行しない |

`schema.prisma` の編集だけでは、`migrate deploy` は変更用SQLを作成しません。
このプロジェクトではSQLを正典にするため、MigrationフォルダとSQLを手動で追加する方式にしています。

## SQLの生成と適用を区別する

| コマンド | 役割 |
| --- | --- |
| `npm run db:validate` | Prisma Schemaの記述を検証する |
| `npm run db:generate` | Prisma SchemaからPrisma Clientを生成する。DB構造は変更しない |
| `npm run db:migrate` | 作成済みのMigration SQLをDBへ適用する |
| `npm run test:db` | テスト用の新しいスキーマへ全Migrationを適用し、整合性とDB制約を検証する |

Prismaの標準的な開発フローでは、Schemaを編集して `prisma migrate dev --create-only --name change_event_title` を実行すると、差分から新しいフォルダとSQLを生成できます。
`--create-only` は新しいMigrationの適用を保留してSQLを編集するための指定です。`migrate dev` は開発用DBとShadow Databaseを使い、履歴との不整合があれば開発用DBのリセットを求めることがあります。
手書きSQLを正典にする今回の運用では、上述の手動追加と `migrate deploy` を使います。
（[Prisma公式：Customizing migrations](https://docs.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations)、[Development and production](https://docs.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)）
