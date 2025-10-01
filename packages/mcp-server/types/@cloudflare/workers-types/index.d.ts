/// <reference no-default-lib="true"/>

export {};

declare global {
  type HeadersInit = Headers | string[][] | Record<string, string>;

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }

  interface Env {
    [key: string]: unknown;
  }

  interface WorkerGlobalScope {
    readonly ENV: Env;
  }

  declare const self: WorkerGlobalScope;

  interface KVNamespace {
    get<T = unknown>(key: string): Promise<T | null>;
    put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expiration?: number; expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  }
}
