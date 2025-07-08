import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getVersion(): string;
  open(name: string): Promise<boolean>;
  put(dbName: string, key: string, value: string): Promise<boolean>;
  get(dbName: string, key: string): Promise<string | null>;
  // 关键错误(Key Mistake): 此处不能使用`delete`作为方法名，因为`delete`是JavaScript的保留关键字。
  // 在Turbo Module的机制下，使用保留关键字作为接口方法名，会导致代码生成(Codegen)失败或产生不可预知的行为，
  // 最终使JS层调用时出现 `_NativeLeveldb.default.delete is not a function` 的错误。
  // 必须使用一个非保留字的名称，如此处的`del`。
  del(dbName: string, key: string): Promise<boolean>;
  close(dbName: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Leveldb');
