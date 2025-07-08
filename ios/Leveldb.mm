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
}
RCT_EXPORT_MODULE()

- (void)dealloc
{
    for (auto const& [key, val] : _dbInstances) {
        delete val;
    }
    _dbInstances.clear();
}

- (void)open:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    // 1. Get the Documents directory path
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

@end
