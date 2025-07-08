// NOTE on a previous critical bug:
// This file previously had duplicated imports from 'react-native', which is a critical error.
// Such duplicated imports can lead to unpredictable runtime errors, including native module methods
// appearing as "undefined is not a function", because it confuses the Metro bundler's module resolution.
// Always ensure imports are clean and not duplicated.
import {
  Text,
  View,
  StyleSheet,
  Button,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  getVersion,
  open,
  put,
  get,
  del,
  close,
  iterator,
  iteratorNext,
  iteratorClose,
} from 'react-native-leveldb';
import { useState } from 'react';

export default function App() {
  const [leveldbVersion, setLeveldbVersion] = useState<string | null>(null);
  const [dbName, setDbName] = useState('my-leveldb');
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [retrievedValue, setRetrievedValue] = useState<string | null>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [iteratorId, setIteratorId] = useState<string | null>(null);
  const [iteratedData, setIteratedData] = useState<[string, string][]>([]);

  const handleGetVersion = () => {
    const version = getVersion();
    setLeveldbVersion(version);
  };

  const handleOpenDb = async () => {
    if (!dbName) {
      setOpenStatus('Please enter a database name.');
      return;
    }
    try {
      setOpenStatus('Opening...');
      const success = await open(dbName);
      setOpenStatus(`Database "${dbName}" opened: ${success}`);
    } catch (e: any) {
      setOpenStatus(`Error opening database: ${e.message}`);
    }
  };

  const handleCloseDb = async () => {
    if (!dbName) {
      setOpenStatus('Please enter a database name.');
      return;
    }
    if (iteratorId) {
      await handleIteratorClose();
    }
    try {
      setOpenStatus('Closing...');
      const success = await close(dbName);
      setOpenStatus(`Database "${dbName}" closed: ${success}`);
    } catch (e: any) {
      setOpenStatus(`Error closing database: ${e.message}`);
    }
  };

  const handlePut = async () => {
    if (!key || !value) {
      setStatusMessage('Please enter a key and value.');
      return;
    }
    try {
      setStatusMessage(`Putting "${key}"...`);
      const success = await put(dbName, key, value);
      setStatusMessage(`Put success: ${success}`);
    } catch (e: any) {
      setStatusMessage(`Put error: ${e.message}`);
    }
  };

  const handleGet = async () => {
    if (!key) {
      setStatusMessage('Please enter a key.');
      return;
    }
    try {
      setStatusMessage(`Getting "${key}"...`);
      const result = await get(dbName, key);
      setRetrievedValue(result);
      setStatusMessage(`Get successful.`);
    } catch (e: any) {
      setStatusMessage(`Get error: ${e.message}`);
    }
  };

  const handleDelete = async () => {
    if (!key) {
      setStatusMessage('Please enter a key to delete.');
      return;
    }
    try {
      setStatusMessage(`Deleting "${key}"...`);
      const success = await del(dbName, key);
      setStatusMessage(`Delete success: ${success}`);
    } catch (e: any) {
      setStatusMessage(`Delete error: ${e.message}`);
    }
  };

  const handleIteratorOpen = async () => {
    if (iteratorId) {
      setStatusMessage('Iterator already open. Close it first.');
      return;
    }
    try {
      setStatusMessage('Creating iterator...');
      const id = await iterator(dbName);
      setIteratorId(id);
      setStatusMessage(`Iterator created with ID: ${id}`);
      setIteratedData([]);
    } catch (e: any) {
      setStatusMessage(`Iterator creation error: ${e.message}`);
    }
  };

  const handleIteratorNext = async () => {
    if (!iteratorId) {
      setStatusMessage('No open iterator.');
      return;
    }
    try {
      const result = await iteratorNext(iteratorId);
      if (result) {
        setIteratedData((prev) => [...prev, result]);
      } else {
        setStatusMessage('End of iteration.');
        await handleIteratorClose(); // Auto-close on finish
      }
    } catch (e: any) {
      setStatusMessage(`Iterator next error: ${e.message}`);
    }
  };

  const handleIteratorClose = async () => {
    if (!iteratorId) {
      setStatusMessage('No open iterator to close.');
      return;
    }
    try {
      await iteratorClose(iteratorId);
      setStatusMessage(`Iterator ${iteratorId} closed.`);
      setIteratorId(null);
    } catch (e: any) {
      setStatusMessage(`Iterator close error: ${e.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Button title="Get LevelDB Version" onPress={handleGetVersion} />
          {leveldbVersion && <Text>LevelDB Version: {leveldbVersion}</Text>}
        </View>
        <View style={styles.section}>
          <Text style={styles.header}>Database</Text>
          <TextInput
            style={styles.input}
            onChangeText={setDbName}
            value={dbName}
            placeholder="e.g., my-leveldb"
          />
          <View style={styles.buttonRow}>
            <Button title="Open DB" onPress={handleOpenDb} />
            <Button title="Close DB" onPress={handleCloseDb} />
          </View>
          {openStatus && <Text style={styles.statusText}>{openStatus}</Text>}
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
            placeholder="Value"
          />
          <View style={styles.buttonRow}>
            <Button title="Put" onPress={handlePut} />
            <Button title="Get" onPress={handleGet} />
            <Button title="Delete" onPress={handleDelete} />
          </View>
          <Text>
            Retrieved Value:{' '}
            {retrievedValue === null ? 'Not Found' : retrievedValue}
          </Text>
          {statusMessage && (
            <Text style={[styles.statusText, { color: '#333' }]}>
              {statusMessage}
            </Text>
          )}
        </View>
        <View style={styles.section}>
          <Text style={styles.header}>Iterator</Text>
          <View style={styles.buttonRow}>
            <Button title="Create Iterator" onPress={handleIteratorOpen} />
            <Button title="Next" onPress={handleIteratorNext} />
            <Button title="Close Iterator" onPress={handleIteratorClose} />
          </View>
          {iteratedData.map(([k, v], i) => (
            <Text key={i}>{`${k}: ${v}`}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  section: {
    marginVertical: 10,
    alignItems: 'center',
    width: '90%',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 20,
  },
  input: {
    height: 40,
    margin: 6,
    borderWidth: 1,
    padding: 10,
    width: '100%',
  },
  statusText: {
    marginTop: 10,
    color: 'green',
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 10,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
