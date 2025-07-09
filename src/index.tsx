import NativeLeveldb, {
  type IteratorOptions as NativeIteratorOptions,
} from './NativeLeveldb';

type Key = string;
type Value = any;
type Encoding = 'utf8' | 'json';

interface Options {
  keyEncoding?: Encoding;
  valueEncoding?: Encoding;
}

interface PutOptions extends Options {}
interface GetOptions extends Options {}
interface DelOptions extends Pick<Options, 'keyEncoding'> {}
interface IteratorOptions
  extends Options,
    Omit<NativeIteratorOptions, 'limit'> {
  limit?: number;
}

type BatchOperation =
  | { type: 'put'; key: Key; value: Value }
  | { type: 'del'; key: Key };

const defaultOptions: Options = {
  keyEncoding: 'utf8',
  valueEncoding: 'utf8',
};

function encode(data: any, encoding: Encoding = 'utf8'): string {
  if (encoding === 'json' || typeof data !== 'string') {
    return JSON.stringify(data);
  }
  return data;
}

function decode(data: string | null, encoding: Encoding = 'utf8'): Value {
  if (data === null) {
    return null;
  }
  if (encoding === 'json') {
    try {
      return JSON.parse(data);
    } catch {
      // Fallback for non-json string
      return data;
    }
  }
  return data;
}

class LevelIterator {
  private iteratorId: string;
  private options: IteratorOptions;
  private ended: boolean = false;
  private cache: [Key, Value][] = [];
  private readonly batchSize = 100;
  private limit: number;
  private count: number = 0;

  constructor(iteratorId: string, options: IteratorOptions) {
    this.iteratorId = iteratorId;
    this.options = options;
    this.limit = options.limit ?? -1;
  }

  async next(): Promise<IteratorResult<[Key, Value]>> {
    if (this.limit !== -1 && this.count >= this.limit) {
      if (!this.ended) {
        await this.close();
      }
      return { done: true, value: undefined };
    }

    if (this.cache.length > 0) {
      const result = this.cache.shift()!;
      this.count++;
      return { done: false, value: result };
    }

    if (this.ended) {
      return { done: true, value: undefined };
    }

    const json = await NativeLeveldb.iterator_next(
      this.iteratorId,
      this.batchSize
    );

    if (typeof json !== 'string' || json.length === 0) {
      this.ended = true;
      await this.close();
      return { done: true, value: undefined };
    }

    try {
      const entries: [string, string][] = JSON.parse(json);
      if (entries.length === 0) {
        this.ended = true;
        await this.close();
        return { done: true, value: undefined };
      }

      for (const [key, value] of entries) {
        const decodedKey = decode(key, this.options.keyEncoding);
        const decodedValue = decode(value, this.options.valueEncoding);
        this.cache.push([decodedKey, decodedValue]);
      }
      return this.next();
    } catch (e) {
      console.error('Failed to parse iterator data:', json);
      this.ended = true;
      await this.close();
      throw e;
    }
  }

  async close(): Promise<void> {
    if (!this.ended) {
      this.ended = true;
      await NativeLeveldb.iterator_close(this.iteratorId);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<[Key, Value]> {
    return this;
  }
}

export class Level {
  private dbName: string;
  private options: Options;
  private openPromise: Promise<boolean>;

  constructor(name: string, options?: Options) {
    if (!name) {
      throw new Error('Database name must be provided');
    }
    this.dbName = name;
    this.options = { ...defaultOptions, ...options };
    this.openPromise = NativeLeveldb.open(this.dbName);
    this.logSupport();
  }

  private logSupport() {
    let supportMessage = 'JS environment check: ';
    try {
      if (typeof Symbol.asyncIterator === 'symbol') {
        supportMessage += 'AsyncIterator is supported. ';
      } else {
        supportMessage += 'AsyncIterator is NOT supported. ';
      }
      if (typeof Promise.allSettled === 'function') {
        supportMessage += 'Promise.allSettled is supported.';
      } else {
        supportMessage += 'Promise.allSettled is NOT supported.';
      }
      console.log(supportMessage);
    } catch (e: any) {
      console.log(`Error checking for feature support: ${e.message}`);
    }
  }

  private async ensureOpened(): Promise<boolean> {
    return this.openPromise;
  }

  async put(key: Key, value: Value, options?: PutOptions): Promise<void> {
    await this.ensureOpened();
    const keyEncoding = options?.keyEncoding || this.options.keyEncoding;
    const valueEncoding = options?.valueEncoding || this.options.valueEncoding;
    await NativeLeveldb.put(
      this.dbName,
      encode(key, keyEncoding),
      encode(value, valueEncoding)
    );
  }

  async get(key: Key, options?: GetOptions): Promise<Value | null> {
    await this.ensureOpened();
    const keyEncoding = options?.keyEncoding || this.options.keyEncoding;
    const valueEncoding = options?.valueEncoding || this.options.valueEncoding;
    const result = await NativeLeveldb.get(
      this.dbName,
      encode(key, keyEncoding)
    );
    // abstract-level: not found 返回 undefined
    return result === null ? undefined : decode(result, valueEncoding);
  }

  async del(key: Key, options?: DelOptions): Promise<void> {
    await this.ensureOpened();
    const keyEncoding = options?.keyEncoding || this.options.keyEncoding;
    await NativeLeveldb.del(this.dbName, encode(key, keyEncoding));
  }

  async getMany(
    keys: Key[],
    options?: GetOptions
  ): Promise<Array<Value | undefined>> {
    // This is a non-optimized implementation. A native `getMany` would be better.
    return Promise.all(keys.map((key) => this.get(key, options)));
  }

  async batch(array: BatchOperation[]): Promise<void> {
    await this.ensureOpened();
    const operations = array.map((op) => {
      const keyEncoding = this.options.keyEncoding;
      if (op.type === 'put') {
        const valueEncoding = this.options.valueEncoding;
        return {
          type: 'put' as const,
          key: encode(op.key, keyEncoding),
          value: encode(op.value, valueEncoding),
        };
      }
      return {
        type: 'del' as const,
        key: encode(op.key, keyEncoding),
      };
    });
    await NativeLeveldb.batch(this.dbName, operations);
  }

  async iterator(options: IteratorOptions = {}): Promise<LevelIterator> {
    await this.ensureOpened();
    const { ...nativeOptions } = options;
    const iteratorId = await NativeLeveldb.iterator_create(
      this.dbName,
      JSON.stringify(nativeOptions)
    );
    return new LevelIterator(iteratorId, options);
  }

  async close(): Promise<void> {
    await this.ensureOpened();
    await NativeLeveldb.close(this.dbName);
  }
}

export default Level;
