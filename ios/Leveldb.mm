#import "Leveldb.h"
#import <leveldb/db.h>
#import <leveldb/env.h>
#import <leveldb/cache.h>
#import <leveldb/write_batch.h>
#import <leveldb/filter_policy.h>
#import <leveldb/comparator.h>
#import <map>
#import <string>

@implementation Leveldb {
    std::map<std::string, leveldb::DB*> _dbInstances;
    std::map<std::string, leveldb::Iterator*> _iteratorInstances;
}
RCT_EXPORT_MODULE()

- (void)dealloc
{
    // Clean up all DB instances
    for (auto const& [key, val] : _dbInstances) {
        delete val;
    }
    _dbInstances.clear();

    // Clean up all iterator instances
    for (auto const& [key, val] : _iteratorInstances) {
        delete val;
    }
    _iteratorInstances.clear();
}

// Why we need to manually create the directory:
// LevelDB's `options.create_if_missing = true` only creates the necessary database files
// (`.sst`, `LOG`, etc.), but it WILL NOT create the parent directory for the database.
// If the directory (e.g., `.../Documents/my-leveldb`) does not exist, LevelDB will fail
// when trying to create the `LOCK` file inside it, resulting in a "NotFound: .../LOCK: No such file or directory" error.
// Therefore, we must ensure the full directory path exists before calling `leveldb::DB::Open`.
- (void)open:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    // 1. Get the Documents directory path, which is a safe, sandboxed location for app data.
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *dbPath = [documentsDirectory stringByAppendingPathComponent:name];

    // 2. Ensure the directory exists
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if (![fileManager fileExistsAtPath:dbPath]) {
        NSError *error = nil;
        BOOL success = [fileManager createDirectoryAtPath:dbPath withIntermediateDirectories:YES attributes:nil error:&error];
        if (!success) {
            NSString *errorMessage = [NSString stringWithFormat:@"Failed to create database directory: %@", [error localizedDescription]];
            reject(@"E_LEVELDB_CREATE_DIR_FAILED", errorMessage, error);
            return;
        }
    }

    leveldb::DB* db;
    leveldb::Options options;
    options.create_if_missing = true;

    // 3. Convert full path to std::string
    const char* db_path_c = [dbPath UTF8String];
    std::string db_path_str(db_path_c);
    
    // Check if db is already open for this path
    if (_dbInstances.count(db_path_str)) {
        resolve(@(true)); // Already open, resolve successfully
        return;
    }

    // 4. Open the database
    leveldb::Status status = leveldb::DB::Open(options, db_path_str, &db);

    if (status.ok()) {
        _dbInstances[db_path_str] = db;
        resolve(@(true));
    } else {
        reject(@"E_LEVELDB_OPEN_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
    }
}

- (NSString *)getVersion {
    return [NSString stringWithFormat:@"%d.%d", leveldb::kMajorVersion, leveldb::kMinorVersion];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeLeveldbSpecJSI>(params);
}

- (void)put:(NSString *)dbName key:(NSString *)key value:(NSString *)value resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    // Get full path and convert to std::string
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *dbPath = [documentsDirectory stringByAppendingPathComponent:dbName];
    std::string db_path_str([dbPath UTF8String]);

    // Find the db instance
    if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
        reject(@"E_DB_NOT_OPEN", @"Database not open. Call open() first.", nil);
        return;
    }
    leveldb::DB *db = _dbInstances[db_path_str];

    // Convert key/value to std::string
    std::string key_str([key UTF8String]);
    std::string value_str([value UTF8String]);

    // Put data
    leveldb::Status status = db->Put(leveldb::WriteOptions(), key_str, value_str);

    if (status.ok()) {
        resolve(@(true));
    } else {
        reject(@"E_LEVELDB_PUT_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
    }
}

- (void)get:(NSString *)dbName key:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    // Get full path and convert to std::string
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *dbPath = [documentsDirectory stringByAppendingPathComponent:dbName];
    std::string db_path_str([dbPath UTF8String]);

    // Find the db instance
    if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
        reject(@"E_DB_NOT_OPEN", @"Database not open. Call open() first.", nil);
        return;
    }
    leveldb::DB *db = _dbInstances[db_path_str];

    // Convert key to std::string
    std::string key_str([key UTF8String]);
    std::string value_str;

    // Get data
    leveldb::Status status = db->Get(leveldb::ReadOptions(), key_str, &value_str);

    if (status.ok()) {
        resolve([NSString stringWithUTF8String:value_str.c_str()]);
    } else if (status.IsNotFound()) {
        resolve(nil); // Resolve with null if key is not found
    }
    else {
        reject(@"E_LEVELDB_GET_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
    }
}

// 关键错误(Key Mistake): 此方法名必须与`NativeLeveldb.ts`中的Spec定义保持一致。
// 最初命名为`delete`，但这与JavaScript保留关键字冲突，导致JS层无法调用。
// 因此，Spec和原生实现都统一为`del`。
- (void)del:(NSString *)dbName key:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    // Get full path and convert to std::string
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *dbPath = [documentsDirectory stringByAppendingPathComponent:dbName];
    std::string db_path_str([dbPath UTF8String]);

    // Find the db instance
    if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
        reject(@"E_DB_NOT_OPEN", @"Database not open. Call open() first.", nil);
        return;
    }
    leveldb::DB *db = _dbInstances[db_path_str];

    // Convert key to std::string
    std::string key_str([key UTF8String]);

    // Delete data
    leveldb::Status status = db->Delete(leveldb::WriteOptions(), key_str);

    if (status.ok()) {
        resolve(@(true));
    } else {
        reject(@"E_LEVELDB_DELETE_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
    }
}

- (void)close:(NSString *)dbName resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    // Get full path and convert to std::string
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *dbPath = [documentsDirectory stringByAppendingPathComponent:dbName];
    std::string db_path_str([dbPath UTF8String]);

    // Find the db instance
    auto it = _dbInstances.find(db_path_str);
    if (it == _dbInstances.end()) {
        // If not found, it might have been already closed. Resolve successfully.
        resolve(@(true));
        return;
    }

    // Close and delete the database instance
    delete it->second;
    // Remove from map
    _dbInstances.erase(it);
    
    resolve(@(true));
}

- (void)iterator:(NSString *)dbName resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    // Get full path and convert to std::string
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *dbPath = [documentsDirectory stringByAppendingPathComponent:dbName];
    std::string db_path_str([dbPath UTF8String]);

    // Find the db instance
    if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
        reject(@"E_DB_NOT_OPEN", @"Database not open. Call open() first.", nil);
        return;
    }
    leveldb::DB *db = _dbInstances[db_path_str];

    // Create iterator
    leveldb::ReadOptions options;
    leveldb::Iterator* it = db->NewIterator(options);
    it->SeekToFirst(); // IMPORTANT: Always seek to the first element upon creation.

    // Generate a unique ID for the iterator
    NSString *iteratorId = [[NSUUID UUID] UUIDString];
    std::string iterator_id_str([iteratorId UTF8String]);

    // Store the iterator instance
    _iteratorInstances[iterator_id_str] = it;

    // Return the iteratorId to JS
    resolve(iteratorId);
}

- (void)iteratorNext:(NSString *)iteratorId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    std::string iterator_id_str([iteratorId UTF8String]);

    // Find the iterator instance
    if (_iteratorInstances.find(iterator_id_str) == _iteratorInstances.end()) {
        reject(@"E_ITERATOR_NOT_FOUND", @"Iterator not found or already closed.", nil);
        return;
    }
    leveldb::Iterator* it = _iteratorInstances[iterator_id_str];

    if (it->Valid()) {
        // Get key and value
        std::string key = it->key().ToString();
        std::string value = it->value().ToString();
        
        // Prepare result array
        NSArray *result = @[[NSString stringWithUTF8String:key.c_str()], [NSString stringWithUTF8String:value.c_str()]];
        
        // Move to next for the subsequent call
        it->Next();
        
        resolve(result);
    } else {
        // End of iteration, resolve with null
        resolve(nil);
    }
}

- (void)iteratorClose:(NSString *)iteratorId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    std::string iterator_id_str([iteratorId UTF8String]);

    // Find the iterator instance
    auto it_map = _iteratorInstances.find(iterator_id_str);
    if (it_map == _iteratorInstances.end()) {
        // Already closed, resolve successfully
        resolve(@(true));
        return;
    }

    // Delete the iterator and remove from map
    delete it_map->second;
    _iteratorInstances.erase(it_map);

    resolve(@(true));
}

@end
