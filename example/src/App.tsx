import { Text, View, StyleSheet, Button } from 'react-native';
import Leveldb, { getVersion } from 'react-native-leveldb';
import { useState } from 'react';

export default function App() {
  const [leveldbVersion, setLeveldbVersion] = useState<string | null>(null);

  const handleGetVersion = () => {
    const version = getVersion();
    setLeveldbVersion(version);
  };

  const handleGetVersionFromDefault = () => {
    const version = Leveldb.getVersion();
    setLeveldbVersion(`From default export: ${version}`);
  };

  return (
    <View style={styles.container}>
      <Button title="Get LevelDB Version" onPress={handleGetVersion} />
      <Button
        title="Get LevelDB Version (from default)"
        onPress={handleGetVersionFromDefault}
      />
      {leveldbVersion && <Text>LevelDB Version: {leveldbVersion}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
