# アーキテクチャガイドライン

このプロジェクトでは、**Next.js + DDD指向のレイヤードアーキテクチャ**を採用します。

Next.jsはPresentation層として自然に使いつつ、Application・Domain・Infrastructureの責務は明確に分離します。

業務ロジックが非自明な場合、Next.jsでよくあるfeature単位・UI単位の構成にバックエンド側まで無理に寄せないでください。

---

# アーキテクチャ概要

以下の4レイヤを基本とします。

```text
src/
├─ app/                    # Presentation
├─ application/            # Application
├─ domain/                 # Domain
└─ infrastructure/         # Infrastructure
```

依存方向は以下です。

```text
Presentation
    ↓
Application
    ↓
Domain
    ↑
Infrastructure
```

Domain層は、Application・Infrastructure・Next.js・Prisma・Reactなどのフレームワーク固有コードに依存してはいけません。

Application層はDomain層に依存できます。

Infrastructure層は、Domain層で定義された抽象に対する実装を提供します。

Presentation層はApplication層およびDomain層に依存できます。

---

# 推奨パッケージ構成

例:

```text
src/
├─ app/
│  ├─ orders/
│  │  ├─ page.tsx
│  │  ├─ actions.ts
│  │  ├─ [id]/
│  │  │  └─ page.tsx
│  │  └─ _components/
│  │
│  └─ layout.tsx
│
├─ application/
│  └─ order/
│     ├─ OrderApplicationService.ts
│     └─ OrderDetailDto.ts
│
├─ domain/
│  └─ order/
│     ├─ Order.ts
│     ├─ OrderId.ts
│     └─ OrderRepository.ts
│
└─ infrastructure/
   ├─ db/
   │  └─ prismaClient.ts
   │
   └─ order/
      └─ PrismaOrderRepository.ts
```

`app/` はPresentation層として扱います。

特別な理由がない限り、トップレベルに`presentation/`ディレクトリを追加しないでください。

Next.jsでは`app/`自体がルーティング上特別な意味を持つため、`app/`をそのままPresentation層とみなす方が自然です。

---

# Domain層

Domain層では、業務上の概念と業務ルールを表現します。

EntityやAggregateは、基本的に**オブジェクト指向で表現することを推奨**します。

例:

```ts
export class Order {
  constructor(
    private readonly id: OrderId,
    private status: OrderStatus,
    private totalAmount: number,
  ) {}

  cancel(): void {
    if (this.status === "shipped") {
      throw new Error("Shipped order cannot be cancelled");
    }

    this.status = "cancelled";
  }
}
```

Entity自身に属する振る舞いは、Entityのメソッドとして表現してください。

以下のような、データだけを持つ貧血モデルに業務ロジックを外部から大量に適用する設計は避けます。

```ts
type Order = {
  id: string;
  status: string;
};
```

業務上Order自身の振る舞いとして自然であれば、

```ts
order.cancel();
order.confirm();
order.changeDestination(...);
```

のように表現してください。

---

# Value Object

**すべてのフィールドをValue Objectにする必要はありません。**

値そのものに意味のある業務ルール、不変条件、振る舞い、識別上の意味がある場合にのみValue Objectを導入します。

Value Objectの候補としては、例えば以下があります。

- 他のIDと混同してはいけない識別子
- 金額など、値自体に意味のある制約があるもの
- ドメイン固有のコード
- 単純な型チェック以上の検証や振る舞いを持つ値

単純な値はprimitiveのままで構いません。

例:

```ts
export class Order {
  constructor(
    private readonly id: OrderId,
    private description: string,
    private quantity: number,
  ) {}
}
```

`description`や`quantity`をValue Objectにすることに明確なドメイン上の価値がないのであれば、primitiveのままで問題ありません。

形式的なValue Objectを大量に作り、ファイル数や間接層だけを増やすことは避けてください。

---

# TypeScriptの構造的型付け

TypeScriptは構造的型付けを採用しています。

同じ構造を持つ異なるドメイン概念が、型上互換になってしまう点に注意してください。

重要な識別子については、classまたはBranded Typeを使用し、異なるIDが誤って代入されないようにすることを検討します。

例:

```ts
export class OrderId {
  constructor(private readonly value: string) {}

  toString(): string {
    return this.value;
  }
}
```

または:

```ts
type Brand<T, B extends string> = T & {
  readonly __brand: B;
};

type OrderId = Brand<string, "OrderId">;
```

ただし、すべてのprimitiveを機械的にclassやBranded Typeへ変換しないでください。

---

# Repository Interface

RepositoryのinterfaceはDomain層に配置します。

RepositoryはDomain Objectを返します。

Prismaのモデル、DBレコード、Presentation DTO、Infrastructure固有型などを返してはいけません。

例:

```ts
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
```

Domain層のRepository interfaceからApplication DTOやPresentation DTOを返さないでください。

また、Domain層をPrismaへ依存させないでください。

---

# Repository実装

Repository実装はInfrastructure層に配置します。

Prismaなどの永続化技術を利用して構いません。

例:

```ts
export class PrismaOrderRepository implements OrderRepository {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const record = await this.prisma.order.findUnique({
      where: {
        id: id.toString(),
      },
    });

    if (!record) {
      return null;
    }

    return Order.reconstruct(
      new OrderId(record.id),
      record.status,
      record.totalAmount,
    );
  }

  async save(order: Order): Promise<void> {
    // Domain Objectを永続化用データへ変換して保存する
  }
}
```

Persistence ModelとDomain Objectは概念的に別物として扱います。

Infrastructure層が両者の変換を担当します。

PrismaはDomain Modelではなく、主に型安全な永続化・クエリ手段として扱ってください。

---

# Prisma Client

共通のPrisma Clientは、例えば以下に配置します。

```text
src/infrastructure/db/prismaClient.ts
```

このファイルはPrisma Clientを生成・提供する責務だけを持ちます。

Repositoryではなく、業務ロジックも持たせません。

例:

```ts
export const prisma = ...
```

Repository実装はこのPrisma Clientを利用できます。

---

# クエリ最適化

N+1対策、JOIN、relation loading、batching、query optimizationなどはInfrastructure層の責務です。

Application層は、Repositoryが内部でどのようにデータを取得したかを意識しません。

例えば、

```ts
orderRepository.findById(id)
```

が必要なDomain Objectを返すのであれば、その内部で

- JOIN
- Prismaのinclude/select
- 複数クエリ
- batching
- relation loading

のどれを使っていてもApplication層には関係ありません。

Persistenceの最適化事情をApplication層へ漏らさないでください。

---

# Application層

Application層では、ユースケースを調整します。

原則として、ユースケースごとに1クラス・1ファイルを機械的に作るのではなく、**凝集度の高いApplication Service単位でまとめる**ことを推奨します。

例:

```ts
export class OrderApplicationService {
  constructor(
    private readonly orderRepository: OrderRepository,
  ) {}

  async create(...): Promise<void> {
    // ユースケースを調整する
  }

  async cancel(orderId: OrderId): Promise<void> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    order.cancel();

    await this.orderRepository.save(order);
  }

  async find(orderId: OrderId): Promise<Order> {
    // ...
  }
}
```

`CreateOrderUseCase`、`CancelOrderUseCase`、`FindOrderUseCase`のように、ユースケースごとに自動的にクラスを分けないでください。

このプロジェクトではレイヤードアーキテクチャを採用しており、明確な理由なくClean Architecture的な構造へ寄せすぎないようにします。

TypeScriptだからという理由だけでApplication Serviceを関数型にする必要もありません。

自然に関数で表現できる箇所では関数を使って構いませんが、OOPを避けること自体を目的にしないでください。

---

# トランザクション境界

トランザクション境界は、原則としてApplication層に置きます。

Application Serviceのユースケース境界とトランザクション境界が一致することを基本とします。

Repository自身がApplication Service全体のトランザクション境界を勝手に決めないでください。

Application Serviceが複数のRepository操作を1つのトランザクションで調整できる構造にします。

Domain ObjectへPrismaなどのトランザクション詳細を漏らしてはいけません。

トランザクション抽象が必要な場合は、Application層がInfrastructure実装へ直接依存しなくてもトランザクション境界を表現できる形にしてください。

---

# Application DTO

Application Serviceは、単一のDomain Entityがそのままユースケース結果を表現できる場合、Domain Entityを直接返して構いません。

レイヤ間をまたぐからという理由だけでDTOを挟む必要はありません。

例:

```ts
async find(id: OrderId): Promise<Order>
```

は許容します。

一方、複数のEntityやAggregateから取得した情報を組み合わせる場合は、Application層でDTOを定義して構いません。

例:

```ts
export type OrderDetailDto = {
  orderId: string;
  customerName: string;
  status: OrderStatus;
  totalAmount: number;
};
```

このDTOはApplication層に属します。

Presentation層がApplication DTOへ依存することは問題ありません。

依存方向は以下の通りです。

```text
Presentation
    ↓
Application
```

Application層が`app/`配下に定義された型へ依存することは避けてください。

---

# Presentation View Model

Application DTOとPresentation用View Modelは別物です。

Application DTOはユースケース結果を表します。

Presentation View ModelはUI固有の表現を持ちます。

例:

```ts
type OrderTableRow = {
  displayAmount: string;
  statusLabel: string;
  statusColor: string;
};
```

以下のような情報はPresentation層に置きます。

- 表示用フォーマット
- ラベル
- 色
- UI固有の状態
- 表示可否

典型的な流れは以下です。

```text
Domain Entity
    ↓
Application Service
    ↓
Application DTO
    ↓
Presentation
    ↓
必要ならView Modelへ変換
    ↓
React Component
```

---

# Next.jsのPresentation層

`src/app/`をPresentation層として扱います。

この層ではNext.jsの規約に従ってください。

代表的な責務は以下です。

```text
page.tsx
    Server Component / ページ表示

actions.ts
    Server Actions

_components/
    React Components

route.ts
    HTTP APIが必要な場合のRoute Handler
```

`app/`の内部までJava/Spring的なパッケージ構成へ無理に寄せないでください。

Presentation層だけは、Next.jsとして自然な構成を優先します。

---

# Server Component

Server ComponentはApplication Serviceを直接呼び出して構いません。

例:

```tsx
export default async function OrderPage() {
  const order =
    await orderApplicationService.find(...);

  return (
    <OrderView order={...} />
  );
}
```

同じNext.jsアプリ内部でしか使わない処理のために、内部REST APIを作る必要はありません。

以下のような構造は、明確な理由がなければ避けます。

```text
Server Component
    ↓ HTTP
/api/orders
    ↓
Application Service
```

直接Application Serviceを呼べるのであれば、そちらを優先してください。

---

# Server Action

Next.js自身のUIから行われる更新処理にはServer Actionを利用できます。

`actions.ts`は薄く保ってください。

例:

```ts
"use server";

export async function cancelOrderAction(
  orderId: string,
): Promise<void> {
  await orderApplicationService.cancel(
    new OrderId(orderId),
  );
}
```

Server ActionはPresentation層です。

業務ルールを書かないでください。

主な責務は以下です。

- Presentationからの入力を受け取る
- 基本的な入力検証や型変換を行う
- Application Serviceを呼び出す
- revalidateやredirectなどPresentation固有処理を行う
- 必要に応じてエラーをPresentation向けに変換する

---

# Route Handler

`route.ts`は、本当にHTTP APIが必要な場合に使用します。

例えば以下です。

- 外部クライアント
- モバイルアプリ
- Webhook
- 外部システム連携
- 明示的に公開するREST API

同じNext.jsアプリのUIからしか利用しない処理のために、Spring Controllerを再現する目的でRoute Handlerを作らないでください。

内部UI操作ではServer Component / Server Actionを優先します。

---

# Server / Client境界

Domain classをClient Componentへそのまま渡せるとは考えないでください。

Server Component内ではDomain Entityを直接扱って構いません。

Client Componentへデータを渡す場合は、シリアライズ可能なplain objectへ変換してください。

例:

```ts
type OrderView = {
  id: string;
  status: string;
  totalAmount: number;
};
```

振る舞いを持つDomain Entityをブラウザ側へ送らないでください。

境界は以下のように考えます。

```text
Domain / Application
      ↓
Server Component
      ↓
serializable data
      ↓
Client Component
```

---

# Client ComponentとHooks

Hooksはクライアント側・UI側の関心事に利用します。

例えば以下です。

- フォーム状態
- モーダル開閉
- ページング
- フィルタ状態
- Browser API
- debounce
- ローカルな操作状態

HooksをApplication層やDomain層の代わりに使わないでください。

HooksからPrismaやDBへ直接アクセスしてはいけません。

悪い例:

```ts
function useOrders() {
  return prisma.order.findMany();
}
```

HooksはUIの世界に閉じ込めます。

---

# Validation

境界ValidationとDomain Ruleを区別してください。

Zodなどによる境界Validationは、例えば以下に利用できます。

- 必須チェック
- primitive型チェック
- 文字数
- parse
- 単純な形式チェック

一方、業務上意味のあるルールや状態依存の制約はDomain層に置きます。

状態依存の業務ルールをZod SchemaやServer Actionへ書かないでください。

DB Constraintによって最終的な整合性を守ることも許容します。

同じ制約が複数レイヤに存在する場合でも、それぞれの責務が異なるのであれば問題ありません。

Domain Modelは業務上の振る舞いを表す中心として扱います。

---

# Dependency Injection

Springを再現するためだけにDI Containerを導入しないでください。

Application ServiceはRepository interfaceなどの抽象に依存します。

Infrastructureの具体実装はアプリケーションの外側で組み立てます。

例:

```ts
const orderRepository =
  new PrismaOrderRepository(prisma);

const orderApplicationService =
  new OrderApplicationService(orderRepository);
```

Application層から`PrismaOrderRepository`をimportしてはいけません。

依存を組み立てるファイル名は固定しません。

`compositionRoot.ts`という名前を無理に採用する必要もありません。

単純で明示的な依存関係の組み立てを優先してください。

---

# Logging / Observability

LoggingやTracingはInfrastructure上の関心事として扱います。

Structured Loggingを推奨します。

Application側で意味のある業務イベントをログとして記録することは構いませんが、一般的なrequest tracingやperformance instrumentationのために独自AOP基盤を作らないでください。

Spring AOPをTypeScript上に再現しないことを基本とします。

横断的な技術関心事には、可能な限り以下のような既存の仕組みを利用します。

- Structured Logging
- OpenTelemetry
- APM
- Request / Trace Context

Domain ObjectをLogging Frameworkへ依存させないでください。

---

# テスト方針

重要な業務ロジックは、Next.jsなしでテストできる構造にします。

推奨する責務分担は以下です。

```text
Domain
→ Unit Test

Application
→ Fake / Stub Repositoryを用いたUnit Test

Infrastructure
→ 必要に応じて実DBを使ったIntegration Test

PresentationのClient Component
→ React Component Test

Server Component / Next統合
→ 必要に応じてIntegration / E2E

ユーザーフロー全体
→ E2E
```

Domain / Applicationテストでは、不要であればBrowser、Next.js Runtime、Prisma DBを必要としないようにしてください。

Repository実装はDomainロジックとは分離してテストします。

薄いPresentation Adapterについて、同じ業務ロジックを重複して細かくテストしすぎないでください。

---

# DB Migration

Prismaを利用する場合でも、Prisma Schemaが必ずDB Migrationの唯一のSource of Truthになるとは限りません。

Migrationの所有方法は明示的に決定してください。

候補としては以下があります。

- Prisma Migrate
- Flywayなど既存Migration Tool
- 組織固有のDB Migration方式

既存DBを利用する場合は、意図的に変更しない限り既存のDB Governanceを維持してください。

Migration Toolの選択とDomain Modelingは分離して考えます。

---

# 設計原則

以下の原則を優先します。

1. Next.js固有の関心事は`app/`に閉じ込める
2. 業務上の振る舞いはDomain Modelへ置く
3. Application Serviceはユースケースを調整する
4. Repository interfaceはDomain Objectを返す
5. PrismaやPersistence ModelはInfrastructureへ閉じ込める
6. 理由なくDTOを増やさない
7. 複数のDomain情報を組み合わせるユースケース結果にはApplication DTOを使う
8. UI固有表現にのみPresentation View Modelを使う
9. すべてのprimitiveをValue Objectにしない
10. TypeScriptだからという理由だけで関数型を強制しない
11. Springで使っていた抽象を、慣れているという理由だけで再現しない
12. Next.jsの一般的なサンプルが単純だからという理由で、有用なDDDパターンを捨てない
13. アーキテクチャ上の形式より、責務境界の明確さを優先する
14. PresentationはNext.jsらしく、バックエンドのDomain ModelはFramework非依存に保つ

---

# 避けるべき設計

以下は避けてください。

```text
app/
  actions.ts
    → 業務ルールを書く
    → 複雑なDomain状態を直接操作する
```

避ける:

```text
application/
  → Prismaをimportする
```

避ける:

```text
domain/
  → Next.jsをimportする
  → Reactをimportする
  → Prismaをimportする
```

避ける:

```text
Repository
  → Prisma生成Modelを返す
```

避ける:

```text
Application Service
  → app/配下で定義された型へ依存する
```

避ける:

```text
Client Component
  → DBへ直接アクセスする
```

避ける:

```text
Server Component
  → 同一アプリのRoute HandlerをHTTP経由で呼ぶ
  → Application Serviceを直接呼べるにもかかわらず
```

避ける:

```text
ユースケースごとに1クラス・1ファイル
```

を無条件のルールにすること。

以下も、具体的な理由がない限り増やしすぎないでください。

- Value Object
- DTO
- Adapter
- Interface
- Factory
- UseCase Class

---

# このアーキテクチャの意図

このプロジェクトでは、意図的に2つのスタイルを組み合わせます。

```text
Presentation
→ Next.jsらしく実装する

Application / Domain / Infrastructure
→ DDD指向のレイヤードアーキテクチャで実装する
```

Domain Modelを一般的なReact / Next.jsコードのように書こうとしないでください。

逆に、Next.jsのPresentation層をJava / SpringのWeb層のように無理に書こうとしないでください。

この境界は意図的なものです。

ドメインの明確さ・テスト容易性を維持しつつ、実装速度を落とすほどの過剰なアーキテクチャにはしないことを重視します。
---

# 認証・認可

このプロジェクトでNext.jsの認証基盤を利用する場合は、Auth.jsを基本的な選択肢とします。

Auth.jsはプロジェクト全体の現在の名称です。Next.js向けのパッケージ名は`next-auth`であり、設定時には`NextAuth()`を使用します。そのため、ドキュメント上では「Auth.js」、コード上では`next-auth` / `NextAuth`という名称が登場します。

認証と認可は分離して考えてください。

```text
Identity Provider
    ↓
Auth.js
    ↓
Presentation
    ↓
Application / Domain
```

Identity Providerはユーザーの本人確認を担当します。

Auth.jsは、Identity ProviderとのOAuth / OpenID Connectフローや、Next.jsアプリケーション上のログイン状態・Session Cookieの取り扱いを担当します。

Application / Domainは、必要に応じて業務上の認可ルールを担当します。

---

## Auth.jsの責務

Auth.jsには主に以下を任せます。

- OAuth / OpenID Connectログインフロー
- Identity Providerへのredirect
- callback処理
- authorization codeとtokenの交換
- Sessionの生成
- Session Cookieの発行・読み取り
- 現在のログインユーザーの復元
- sign-in / sign-out処理

典型的な設定例:

```ts
import NextAuth from "next-auth";

export const {
  auth,
  handlers,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    // Identity Provider
  ],
});
```

主なAPIは以下のように扱います。

```text
auth()
    → 現在のリクエストの認証Sessionを取得する

signIn()
    → sign-inフローを開始する

signOut()
    → アプリケーションのSessionを終了する

handlers
    → OAuth / OIDC callbackなどAuth.js用HTTP endpointを処理する
```

OAuth / OpenID Connectプロトコルを独自実装しないでください。

---

## Session Strategy

Auth.jsではSession Strategyとして、主に以下を利用できます。

```text
JWT Session
Database Session
```

### JWT Session

JWT Sessionでは、Session情報を暗号化されたCookieとしてブラウザ側に保持し、リクエスト時にブラウザがCookieを送信します。

```text
Browser
    ↓ Session Cookie
Next.js
    ↓
Auth.js
    ↓ decode / decrypt / validate
Session
```

サーバー側でSession Storeを持たないため、複数のアプリケーションインスタンス間でRedisなどのSession Storeを共有する必要がありません。

各インスタンスが同じAuth.jsのsecret等を利用できる状態にしてください。

`auth()`は、JWT Session Strategyの場合でもサーバー上のSession Storeを検索しているとは限りません。

リクエストに付与されたSession Cookieからログイン状態を復元しているものとして考えてください。

---

### Database Session

Database Sessionでは、ブラウザはSession TokenをCookieとして保持し、Session本体をDatabaseなどの共有Storeで管理します。

```text
Browser
    ↓ Session Token Cookie
Next.js
    ↓
Session Store
    ↓
Session
```

以下のような要件がある場合はDatabase Sessionを検討できます。

- 個別Sessionをサーバー側から即時失効させたい
- ログイン端末やSession一覧を管理したい
- 同時Sessionを厳密に管理したい
- 管理者操作で特定Sessionを無効化したい

JWT SessionとDatabase Sessionのどちらを採用するかは、Session管理要件を確認して決定してください。

単に「JWTの方が新しい」などの理由だけで選択しないでください。

---

## Auth.js Session JWTとAccess Tokenを混同しない

Auth.jsのJWT Sessionと、Identity Providerが発行するAccess Tokenは別の概念です。

```text
Auth.js Session JWT
    → このNext.jsアプリ上のログイン状態を表現する

Access Token
    → API / Resource Serverへアクセスするための資格情報
```

どちらもJWT形式になる場合がありますが、用途は異なります。

Auth.jsでJWT Sessionを採用したからといって、Client ComponentからすべてのAPIへ以下のようなBearer Tokenを付与する必要はありません。

```http
Authorization: Bearer <access-token>
```

Next.js一体型アプリでは、通常はSession Cookieをブラウザが自動的に送信し、サーバー側で`auth()`を利用して認証情報を取得します。

```text
Browser
    ↓ Cookie
Next.js
    ↓
auth()
    ↓
Session
```

---

## Bearer Token方式との違い

SPAと独立したREST APIのような構成では、Access TokenをBearer Tokenとして送信する方式が自然な場合があります。

```text
SPA
    ↓ Authorization: Bearer <access-token>
REST API
    ↓
JWT検証
```

この場合、ClientがAccess Tokenを取得・保持し、APIリクエスト時に`Authorization`ヘッダへ付与します。

一方、Auth.js JWT Sessionを利用するNext.js一体型アプリでは、

```text
Browser
    ↓ Cookie
Next.js / Auth.js
```

というCookieベースのSessionとして扱えます。

「JWTを使っている」ことと「Bearer Token方式を採用している」ことを同一視しないでください。

---

## 認証と認可の境界

認証と認可を混同しないでください。

```text
Authentication
    → 誰であるか

Authorization
    → そのユーザーが何をしてよいか
```

Auth.jsは主にAuthenticationとSession管理を担当します。

Presentation層では、例えば以下のようなシステム上のアクセス制御を行って構いません。

- ログインしていなければログイン画面へ遷移する
- 特定Role以外は管理画面を表示しない
- 認証済みユーザー情報をApplication Serviceへ渡す

例:

```ts
const session = await auth();

if (!session) {
  // redirectなど
}

await orderApplicationService.cancel(
  session.user.id,
  orderId,
);
```

一方、以下のような業務上の認可ルールはApplication / Domainへ置きます。

- このユーザーがこのEntityを操作できるか
- この状態のEntityをこのActorが変更できるか
- 所有者本人のみ実行できる操作
- 承認者のみ実行できる業務操作

業務上の認可ルールをClient Componentの表示制御だけで保証しないでください。

UI上でボタンを非表示にしていても、Application / Domain側で必要なルールを保証してください。

---

## Server Component / Server Actionでの認証

Server ComponentやServer Actionでは、必要に応じて`auth()`で現在のSessionを取得します。

認証確認をClient Componentだけに任せないでください。

```text
Client Component
    → UI上の表示制御

Server Component / Server Action
    → 信頼できる認証確認

Application / Domain
    → 必要な業務認可
```

Server Actionは外部から呼び出され得るサーバー側入口として扱い、Client側で認証済みだからという理由で認証・認可を省略しないでください。

---

## CookieとSessionの扱い

Auth.jsが管理するSession Cookieを、独自のClientコードで読み書きすることを基本的に避けてください。

Session CookieはAuth.jsに管理させます。

Clientからログイン状態が必要な場合も、Auth.jsが提供するAPIやServer側の`auth()`を優先してください。

Cookie、JWTの暗号化・復号、OAuth / OIDCのstateやPKCEなどのプロトコル詳細を独自実装しないでください。

---

## 認証・認可に関する設計原則

以下を優先します。

1. Identity Providerによる本人確認と、アプリケーション内Sessionを区別する
2. Auth.js Session JWTとAccess Tokenを区別する
3. JWTとBearer Token方式を同一視しない
4. OAuth / OpenID ConnectフローはAuth.jsへ任せる
5. Session管理方式はJWT / Databaseの要件を比較して決める
6. 認証済みかどうかだけで業務認可を完了したと考えない
7. 業務上の認可ルールはApplication / Domainで保証する
8. Client Componentの表示制御をセキュリティ境界として扱わない
9. Server Component / Server Action側でも必要な認証確認を行う
10. Auth.jsを使うためだけにDomain層をAuth.jsへ依存させない

Domain層からAuth.js、Next.js、Session Cookie、OAuth Tokenなどを参照しないでください。

認証基盤の詳細はPresentation / Infrastructure側に閉じ込め、Domainには必要なActorやUserIdなど、ドメイン上意味のある情報だけを渡してください。
