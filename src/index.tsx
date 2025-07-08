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

export function del(dbName: string, key: string): Promise<boolean> {
  return Leveldb.del(dbName, key);
}

export function close(dbName: string): Promise<boolean> {
  return Leveldb.close(dbName);
}

export function iterator(dbName: string): Promise<string> {
  return Leveldb.iterator(dbName);
}

export function iteratorNext(
  iteratorId: string
): Promise<[string, string] | null> {
  return Leveldb.iteratorNext(iteratorId);
}

export function iteratorClose(iteratorId: string): Promise<boolean> {
  return Leveldb.iteratorClose(iteratorId);
}

export default Leveldb;
