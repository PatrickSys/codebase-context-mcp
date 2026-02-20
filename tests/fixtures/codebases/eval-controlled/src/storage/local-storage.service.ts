export class LocalStorageService {
  private readonly memory = new Map<string, string>();

  set<T>(key: string, value: T): void {
    this.memory.set(key, JSON.stringify(value));
  }

  get<T>(key: string): T | null {
    const value = this.memory.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  has(key: string): boolean {
    return this.memory.has(key);
  }

  remove(key: string): void {
    this.memory.delete(key);
  }
}
