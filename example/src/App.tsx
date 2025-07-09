import {
  Text,
  View,
  StyleSheet,
  Button,
  TextInput,
  SafeAreaView,
  ScrollView,
  Platform,
  TouchableOpacity,
  Clipboard,
} from 'react-native';
import Level from 'react-native-leveldb';
import { useState, useEffect, useRef } from 'react';

// Simple deep equal function for test verification
function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function App() {
  const [dbName, setDbName] = useState(
    `my-leveldb-${Platform.OS}-${Date.now()}`
  );
  const [dbInstance, setDbInstance] = useState<Level | null>(null);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [retrievedValue, setRetrievedValue] = useState<any | null>('');
  const [log, setLog] = useState<string[]>([]);
  const [iteratorOptions, setIteratorOptions] = useState({
    gt: '',
    lt: '',
    limit: '',
  });
  const scrollViewRef = useRef<ScrollView>(null);

  const addLog = (message: string) => {
    console.log(message);
    setLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...prev,
    ]);
  };

  useEffect(() => {
    return () => {
      dbInstance?.close();
    };
  }, [dbInstance]);

  const handleOpenDb = async () => {
    if (!dbName) {
      addLog('Please enter a database name.');
      return;
    }
    try {
      addLog(`Opening db: ${dbName}`);
      const db = new Level(dbName, { valueEncoding: 'json' });
      setDbInstance(db);
      addLog(`Database "${dbName}" is ready.`);
    } catch (e: any) {
      addLog(`Error opening database: ${e.message}\n${e.stack}`);
    }
  };

  const handleCloseDb = async () => {
    if (!dbInstance) return addLog('Database is not open.');
    try {
      addLog('Closing...');
      await dbInstance.close();
      setDbInstance(null);
      addLog(`Database "${dbName}" closed.`);
      setRetrievedValue('');
      setLog([]);
    } catch (e: any) {
      addLog(`Error closing database: ${e.message}\n${e.stack}`);
    }
  };

  const handlePut = async () => {
    if (!dbInstance) return addLog('DB not open');
    if (!key || !value) return addLog('Key and value required');
    try {
      let parsedValue: any = value;
      try {
        parsedValue = JSON.parse(value);
      } catch (e) {
        /* not json */
      }
      await dbInstance.put(key, parsedValue);
      addLog(`Put success: ${key} = ${JSON.stringify(parsedValue)}`);
    } catch (e: any) {
      addLog(`Put error: ${e.message}\n${e.stack}`);
    }
  };

  const handleGet = async () => {
    if (!dbInstance) return addLog('DB not open');
    if (!key) return addLog('Key required');
    try {
      const result = await dbInstance.get(key);
      setRetrievedValue(result);
      addLog(`Get success: ${key} -> ${JSON.stringify(result)}`);
    } catch (e: any) {
      addLog(`Get error: ${e.message}\n${e.stack}`);
    }
  };

  const handleDelete = async () => {
    if (!dbInstance) return addLog('DB not open');
    if (!key) return addLog('Key required');
    try {
      await dbInstance.del(key);
      addLog(`Delete success: ${key}`);
    } catch (e: any) {
      addLog(`Delete error: ${e.message}\n${e.stack}`);
    }
  };

  const batchData = [
    { type: 'put', key: 'user:1', value: { name: 'Alice', age: 30 } },
    { type: 'put', key: 'user:2', value: { name: 'Bob', age: 35 } },
    { type: 'put', key: 'item:a', value: 'Apple' },
    { type: 'put', key: 'item:b', value: 'Banana' },
  ];
  const batchKeys = batchData.map((d) => d.key);

  const handleBatchPut = async () => {
    if (!dbInstance) return addLog('DB not open');
    try {
      await dbInstance.batch(batchData as any);
      addLog(`Batch put successful for keys: ${batchKeys.join(', ')}`);
    } catch (e: any) {
      addLog(`Batch put error: ${e.message}\n${e.stack}`);
    }
  };

  const handleBatchGet = async () => {
    if (!dbInstance) return addLog('DB not open');
    try {
      const results = await Promise.all(
        batchKeys.map((k) => dbInstance.get(k))
      );
      addLog(`Batch get results: ${JSON.stringify(results, null, 2)}`);
    } catch (e: any) {
      addLog(`Batch get error: ${e.message}\n${e.stack}`);
    }
  };

  const handleBatchDel = async () => {
    if (!dbInstance) return addLog('DB not open');
    try {
      const delOps = batchKeys.map((k) => ({ type: 'del' as const, key: k }));
      await dbInstance.batch(delOps);
      addLog(`Batch del successful for keys: ${batchKeys.join(', ')}`);
    } catch (e: any) {
      addLog(`Batch del error: ${e.message}\n${e.stack}`);
    }
  };

  const handleIterate = async () => {
    if (!dbInstance) return addLog('DB not open');
    let iterator;
    try {
      const opts: any = {};
      if (iteratorOptions.gt) opts.gt = iteratorOptions.gt;
      if (iteratorOptions.lt) opts.lt = iteratorOptions.lt;
      if (iteratorOptions.limit)
        opts.limit = parseInt(iteratorOptions.limit, 10);

      addLog(`Iterating with options: ${JSON.stringify(opts)}`);
      iterator = await dbInstance.iterator(opts);
      const data = [];
      // NOTE: Using a manual while loop instead of `for await...of`
      // because the JS engine (e.g. Hermes) in this environment may not
      // fully support the async iterator protocol. This is a more robust
      // way to iterate.
      while (true) {
        const result = await iterator.next();
        if (result.done) {
          break;
        }
        data.push(result.value);
      }
      addLog(`Iteration result: ${JSON.stringify(data, null, 2)}`);
    } catch (e: any) {
      addLog(`Iteration error: ${e.message}\n${e.stack}`);
    } finally {
      await iterator?.close();
    }
  };

  const runCrudTest = async () => {
    if (!dbInstance) return addLog('DB not open for CRUD test');
    addLog('--- Starting CRUD Test ---');
    try {
      addLog('Step 1: Put');
      await dbInstance.put('1', '1');
      addLog('Step 2: Get');
      const val1 = await dbInstance.get('1');
      if (!deepEqual(val1, '1')) throw new Error('Get verification failed');
      addLog('Get verified.');
      addLog('Step 3: Delete');
      await dbInstance.del('1');
      addLog('Step 4: Get after delete');
      const val2 = await dbInstance.get('1');
      if (val2 !== null) throw new Error('Get after delete failed');
      addLog('Get after delete verified.');
      addLog('Step 5: Put again');
      await dbInstance.put('1', '2');
      addLog('Step 6: Get again');
      const val3 = await dbInstance.get('1');
      if (!deepEqual(val3, '2'))
        throw new Error('Second get verification failed');
      addLog('Second get verified.');
      addLog('--- CRUD Test Passed ---');
    } catch (e: any) {
      addLog(`--- CRUD Test Failed: ${e.message}\n${e.stack} ---`);
    }
  };

  const runBatchAndIteratorTest = async () => {
    if (!dbInstance) return addLog('DB not open for batch/iterator test');
    addLog('--- Starting Batch & Iterator Test ---');
    let iterator;
    try {
      addLog('Step 1: Batch Put');
      await handleBatchPut();
      addLog('Step 2: Batch Get');
      const many = await Promise.all(batchKeys.map((k) => dbInstance.get(k)));
      if (many.length !== 4 || many.some((v) => v === null))
        throw new Error('Batch get verification failed');
      addLog('Batch get verified.');
      addLog('Step 3: Iterate');
      iterator = await dbInstance.iterator({
        gt: 'user:',
        lt: 'user:~',
      });
      const iterResult = [];
      // NOTE: Using a manual while loop instead of `for await...of`
      // because the JS engine (e.g. Hermes) in this environment may not
      // fully support the async iterator protocol. This is a more robust
      // way to iterate.
      while (true) {
        const result = await iterator.next();
        if (result.done) {
          break;
        }
        iterResult.push(result.value);
      }
      if (iterResult.length !== 2)
        throw new Error(
          `Iterator count failed. Expected 2, got ${iterResult.length}`
        );
      addLog('Iterator verified.');
      addLog('Step 4: Batch Del');
      await handleBatchDel();
      const afterDel = await Promise.all(
        batchKeys.map((k) => dbInstance.get(k))
      );
      if (afterDel.some((v: any) => v !== null))
        throw new Error('Batch del verification failed');
      addLog('Batch del verified.');
      addLog('--- Batch & Iterator Test Passed ---');
    } catch (e: any) {
      addLog(`--- Batch & Iterator Test Failed: ${e.message}\n${e.stack} ---`);
    } finally {
      await iterator?.close();
    }
  };

  const copyLogs = () => {
    Clipboard.setString(log.join('\n'));
    addLog('Logs copied to clipboard!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        <View style={styles.section}>
          <Text style={styles.header}>Database</Text>
          <TextInput
            style={styles.input}
            onChangeText={setDbName}
            value={dbName}
            placeholder="e.g., my-leveldb"
            editable={!dbInstance}
          />
          <View style={styles.buttonRow}>
            <Button
              title="Open DB"
              onPress={handleOpenDb}
              disabled={!!dbInstance}
            />
            <Button
              title="Close DB"
              onPress={handleCloseDb}
              disabled={!dbInstance}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.header}>CRUD Operations</Text>
          <TextInput
            style={styles.input}
            onChangeText={setKey}
            value={key}
            placeholder="Key"
          />
          <TextInput
            style={styles.input}
            onChangeText={setValue}
            value={value}
            placeholder='Value (e.g., {"a":1})'
          />
          <View style={styles.buttonRow}>
            <Button title="Put" onPress={handlePut} disabled={!dbInstance} />
            <Button title="Get" onPress={handleGet} disabled={!dbInstance} />
            <Button
              title="Delete"
              onPress={handleDelete}
              disabled={!dbInstance}
            />
          </View>
          <Text>Retrieved: {JSON.stringify(retrievedValue)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.header}>Batch Operations</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Batch Put"
              onPress={handleBatchPut}
              disabled={!dbInstance}
            />
            <Button
              title="Batch Get"
              onPress={handleBatchGet}
              disabled={!dbInstance}
            />
            <Button
              title="Batch Del"
              onPress={handleBatchDel}
              disabled={!dbInstance}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.header}>Iterator</Text>
          <TextInput
            style={styles.input}
            placeholder="Greater than (gt)"
            value={iteratorOptions.gt}
            onChangeText={(t) => setIteratorOptions((o) => ({ ...o, gt: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Less than (lt)"
            value={iteratorOptions.lt}
            onChangeText={(t) => setIteratorOptions((o) => ({ ...o, lt: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Limit"
            keyboardType="numeric"
            value={iteratorOptions.limit}
            onChangeText={(t) =>
              setIteratorOptions((o) => ({ ...o, limit: t }))
            }
          />
          <Button
            title="Iterate"
            onPress={handleIterate}
            disabled={!dbInstance}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.header}>Auto Test</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Test CRUD"
              onPress={runCrudTest}
              disabled={!dbInstance}
            />
            <Button
              title="Test Batch & Iterator"
              onPress={runBatchAndIteratorTest}
              disabled={!dbInstance}
            />
          </View>
        </View>

        <View style={styles.logSection}>
          <View style={styles.logHeader}>
            <Text style={[styles.header, { color: '#f8f8f2' }]}>Logs</Text>
            <TouchableOpacity onPress={copyLogs}>
              <Text style={styles.copyButton}>Copy</Text>
            </TouchableOpacity>
          </View>
          {log.map((msg, i) => (
            <Text key={i} style={styles.logText}>
              {msg}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingBottom: 50, alignItems: 'center' },
  section: {
    marginVertical: 8,
    width: '95%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  logSection: {
    marginTop: 8,
    width: '95%',
    padding: 10,
    backgroundColor: '#272822', // Monokai theme background
    borderRadius: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  copyButton: {
    color: '#66d9ef', // Monokai cyan
    fontSize: 14,
  },
  input: {
    height: 40,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 10,
    width: '100%',
    backgroundColor: 'white',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 5,
  },
  header: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  logText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13,
    color: '#f8f8f2', // Monokai theme foreground
    marginBottom: 2,
  },
});
