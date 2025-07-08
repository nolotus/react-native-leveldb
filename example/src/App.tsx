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
} from 'react-native';
import { getVersion, open, put, get } from 'react-native-leveldb';
import { useState } from 'react';

export default function App() {
  const [leveldbVersion, setLeveldbVersion] = useState<string | null>(null);
  const [dbName, setDbName] = useState('my-leveldb');
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [retrievedValue, setRetrievedValue] = useState<string | null>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.section}>
        <Button title="Get LevelDB Version" onPress={handleGetVersion} />
        {leveldbVersion && <Text>LevelDB Version: {leveldbVersion}</Text>}
      </View>
      <View style={styles.section}>
        <Text>Database Name:</Text>
        <TextInput
          style={styles.input}
          onChangeText={setDbName}
          value={dbName}
          placeholder="e.g., my-leveldb"
        />
        <Button title="Open DB" onPress={handleOpenDb} />
        {openStatus && <Text style={styles.statusText}>{openStatus}</Text>}
      </View>
      <View style={styles.section}>
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
        </View>
        <Text>
          Retrieved Value:{' '}
          {retrievedValue === null ? 'Not Found' : retrievedValue}
        </Text>
        {statusMessage && (
          <Text style={styles.statusText}>{statusMessage}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginVertical: 10,
    alignItems: 'center',
    width: '90%',
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
});
