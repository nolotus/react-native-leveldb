import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getVersion(): string;
  open(name: string): Promise<boolean>;
  put(dbName: string, key: string, value: string): Promise<boolean>;
  get(dbName: string, key: string): Promise<string | null>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Leveldb');
