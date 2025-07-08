import {
  Text,
  View,
  StyleSheet,
  Button,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { getVersion, open } from 'react-native-leveldb';
import { useState } from 'react';

export default function App() {
  const [leveldbVersion, setLeveldbVersion] = useState<string | null>(null);
  const [dbName, setDbName] = useState('my-leveldb');
  const [openStatus, setOpenStatus] = useState<string | null>(null);

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
    marginVertical: 20,
    alignItems: 'center',
    width: '90%',
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
    width: '100%',
  },
  statusText: {
    marginTop: 10,
    color: 'green',
    fontWeight: 'bold',
  },
});
