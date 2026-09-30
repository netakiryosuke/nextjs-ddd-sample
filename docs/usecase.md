# ユースケース図

ユースケースは「催事一覧を閲覧する」「催事詳細を閲覧する」「予約する」「キャンセルする」の4つです。
アクターは「利用者（客）」の1種類とします。認証の有無は各操作の前提条件として扱います。
各操作で使う業務用語は [ユビキタス言語](./ubiquitous-language.md) を参照してください。
Mermaidのflowchartで利用者とユースケースの関係を表しています。

```mermaid
flowchart LR
    customer["利用者（客）"]

    subgraph system["催事予約アプリ"]
        list(["催事一覧を閲覧する"])
        detail(["催事詳細を閲覧する"])
        reserve(["催事を予約する"])
        cancel(["自分の予約をキャンセルする"])
    end

    customer --- list
    customer --- detail
    customer --- reserve
    customer --- cancel
```

## 画面と操作

| 画面 | 利用者の操作 | Applicationの操作案 |
| --- | --- | --- |
| 催事一覧 | 催事を探して詳細を開く | `EventApplicationService.list`（`Event` を使う案。空き状況を表示するなら `EventAvailability`） |
| 催事詳細 | 開催情報・会場名・残席・自分の予約状態を見る | `EventApplicationService.find`（中核に `EventAvailability` を使用） |
| 催事詳細 | 予約する | `EventApplicationService.reserve` |
| 催事詳細 | 自分の予約をキャンセルする | `EventApplicationService.cancel` |

一覧・詳細の閲覧は未認証でも可能とする案です。更新には認証を必要とします。
認証済みの詳細表示では、自分の有効な予約を表示対象にします。キャンセル済みの記録は保存しますが、初期版に履歴画面は設けません。
ログインは認証基盤のフローとして扱い、専用の業務画面を追加するかは認証実装時に決定します。

催事と会場は初期データで用意し、今回のユースケースには催事・会場の登録・編集を含めません。
ユーザー管理、複数席の予約、キャンセル待ち、チェックインも初期モデルの対象外です。

業務ルールと予約状態は [ドメインモデル](./domain-model.md)、保存構造は [ERD](./ERD.md) を参照してください。
