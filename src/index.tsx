import Leveldb from './NativeLeveldb';

export function getVersion(): string {
  return Leveldb.getVersion();
}

export function open(name: string): Promise<boolean> {
  return Leveldb.open(name);
}

export class DB {
  private dbName: string | null = null;

  constructor(dbName?: string) {
    if (dbName) {
      this.dbName = dbName;
    }
  }

  async open(dbName?: string): Promise<boolean> {
    if (dbName) {
      this.dbName = dbName;
    }
    if (!this.dbName) {
      throw new Error(
        'Database name must be provided either in constructor or open method'
      );
    }
    return Leveldb.open(this.dbName);
  }

  async put(key: string, value: string): Promise<boolean> {
    if (!this.dbName) {
      throw new Error('Database must be opened before operation');
    }
    return Leveldb.put(this.dbName, key, value);
  }

  async get(key: string): Promise<string | null> {
    if (!this.dbName) {
      throw new Error('Database must be opened before operation');
    }
    return Leveldb.get(this.dbName, key);
  }

  async del(key: string): Promise<boolean> {
    if (!this.dbName) {
      throw new Error('Database must be opened before operation');
    }
    return Leveldb.del(this.dbName, key);
  }

  async close(): Promise<boolean> {
    if (!this.dbName) {
      throw new Error('Database must be opened before operation');
    }
    const result = await Leveldb.close(this.dbName);
    this.dbName = null;
    return result;
  }

  async iterator(): Promise<string> {
    if (!this.dbName) {
      throw new Error('Database must be opened before operation');
    }
    return Leveldb.iterator(this.dbName);
  }

  async iteratorNext(iteratorId: string): Promise<[string, string] | null> {
    return Leveldb.iteratorNext(iteratorId);
  }

  async iteratorClose(iteratorId: string): Promise<boolean> {
    return Leveldb.iteratorClose(iteratorId);
  }
}

export function createDB(dbName?: string): DB {
  return new DB(dbName);
}

export default Leveldb;
