import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface IteratorOptions {
  gt?: string;
  gte?: string;
  lt?: string;
  lte?: string;
  reverse?: boolean;
  limit?: number;
}

export interface Spec extends TurboModule {
  // --- General Methods ---
  getVersion(): string;
  open(name: string): Promise<boolean>;
  close(dbName: string): Promise<boolean>;

  // --- Data Methods ---
  put(dbName: string, key: string, value: string): Promise<boolean>;
  get(dbName: string, key: string): Promise<string | null>;
  del(dbName: string, key: string): Promise<boolean>;
  batch(
    dbName: string,
    operations: Array<
      { type: 'put'; key: string; value: string } | { type: 'del'; key: string }
    >
  ): Promise<boolean>;

  // --- Iterator Methods (New Granular API) ---
  /**
   * Creates a new iterator on the native side and returns its unique ID.
   * @param optionsJSON A JSON string of the IteratorOptions.
   */
  iterator_create(dbName: string, optionsJSON: string): Promise<string>;

  /**
   * Fetches the next `count` entries from the iterator specified by `iteratorId`.
   * Returns a JSON string of an array of [key, value] pairs.
   */
  iterator_next(iteratorId: string, count: number): Promise<string | null>;

  /**
   * Seeks the iterator to the given key.
   */
  iterator_seek(iteratorId: string, key: string): void;

  /**
   * Closes and releases the native iterator.
   */
  iterator_close(iteratorId: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Leveldb');
