export class AccessDeniedError extends Error {
  constructor() {
    super("この操作を実行する権限がありません。");
    this.name = "AccessDeniedError";
  }
}
