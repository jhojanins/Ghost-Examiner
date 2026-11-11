/** Injected time source in milliseconds (ARCHITECTURE.md §1). Implemented in packages/web. */
export interface Clock {
  now(): number;
}
