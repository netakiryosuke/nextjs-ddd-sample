export interface TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
