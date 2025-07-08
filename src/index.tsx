import Leveldb from './NativeLeveldb';

export function getVersion(): string {
  return Leveldb.getVersion();
}

export function open(name: string): Promise<boolean> {
  return Leveldb.open(name);
}

export function put(
  dbName: string,
  key: string,
  value: string
): Promise<boolean> {
  return Leveldb.put(dbName, key, value);
}

export function get(dbName: string, key: string): Promise<string | null> {
  return Leveldb.get(dbName, key);
}

export default Leveldb;
