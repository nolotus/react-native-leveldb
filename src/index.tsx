import Leveldb from './NativeLeveldb';

export function getVersion(): string {
  return Leveldb.getVersion();
}

export default Leveldb;
