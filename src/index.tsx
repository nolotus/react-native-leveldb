import Leveldb from './NativeLeveldb';

export function getVersion(): string {
  return Leveldb.getVersion();
}

export function open(name: string): Promise<boolean> {
  return Leveldb.open(name);
}

export default Leveldb;
