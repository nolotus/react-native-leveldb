#import "Leveldb.h"
#import <leveldb/db.h>
#import <leveldb/env.h>
#import <leveldb/cache.h>
#import <leveldb/write_batch.h>
#import <leveldb/filter_policy.h>
#import <leveldb/comparator.h>
#import <map>
#import <string>

// Helper to safely convert id to std::string
static std::string to_std_string(id obj) {
    if (obj == nil || obj == [NSNull null] || ![obj isKindOfClass:[NSString class]]) {
        return "";
    }
    return std::string([(NSString *)obj UTF8String]);
}

struct IteratorWrapper {
    leveldb::Iterator* iterator;
    __strong NSDictionary* options;

    IteratorWrapper(leveldb::Iterator* it, NSDictionary* opts)
        : iterator(it), options(opts) {}

    ~IteratorWrapper() {
        delete iterator;
        // ARC will handle the release of options
    }
};

@implementation Leveldb {
    std::map<std::string, leveldb::DB*> _dbInstances;
    std::map<std::string, IteratorWrapper*> _iteratorInstances;
}
RCT_EXPORT_MODULE()

- (void)dealloc
{
    for (auto const& [key, val] : _dbInstances) {
        delete val;
    }
    _dbInstances.clear();
    for (auto const& [key, val] : _iteratorInstances) {
        delete val;
    }
    _iteratorInstances.clear();
}

- (NSString *)getDbFullPath:(NSString *)dbName
{
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    return [documentsDirectory stringByAppendingPathComponent:dbName];
}

- (void)open:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        NSString *dbPath = [self getDbFullPath:name];
        std::string db_path_str([dbPath UTF8String]);

        if (_dbInstances.count(db_path_str)) {
            resolve(@(true));
            return;
        }

        NSFileManager *fileManager = [NSFileManager defaultManager];
        if (![fileManager fileExistsAtPath:dbPath]) {
            NSError *error = nil;
            if (![fileManager createDirectoryAtPath:dbPath withIntermediateDirectories:YES attributes:nil error:&error]) {
                reject(@"E_LEVELDB_CREATE_DIR_FAILED", [NSString stringWithFormat:@"Failed to create database directory: %@", [error localizedDescription]], error);
                return;
            }
        }

        leveldb::DB* db;
        leveldb::Options options;
        options.create_if_missing = true;
        leveldb::Status status = leveldb::DB::Open(options, db_path_str, &db);

        if (status.ok()) {
            _dbInstances[db_path_str] = db;
            resolve(@(true));
        } else {
            reject(@"E_LEVELDB_OPEN_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
        }
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

- (void)close:(NSString *)dbName resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        std::string db_path_str([[self getDbFullPath:dbName] UTF8String]);
        auto it = _dbInstances.find(db_path_str);
        if (it != _dbInstances.end()) {
            delete it->second;
            _dbInstances.erase(it);
        }
        resolve(@(true));
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
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
    @try {
        std::string db_path_str([[self getDbFullPath:dbName] UTF8String]);
        if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
            reject(@"E_DB_NOT_OPEN", @"Database not open", nil);
            return;
        }
        leveldb::WriteOptions writeOptions;
        writeOptions.sync = true;
        leveldb::Status status = _dbInstances[db_path_str]->Put(writeOptions, to_std_string(key), to_std_string(value));
        if (status.ok()) resolve(@(true));
        else reject(@"E_LEVELDB_PUT_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

- (void)get:(NSString *)dbName key:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        std::string db_path_str([[self getDbFullPath:dbName] UTF8String]);
        if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
            reject(@"E_DB_NOT_OPEN", @"Database not open", nil);
            return;
        }
        std::string value_str;
        leveldb::Status status = _dbInstances[db_path_str]->Get(leveldb::ReadOptions(), to_std_string(key), &value_str);
        if (status.ok()) resolve([NSString stringWithUTF8String:value_str.c_str()]);
        else if (status.IsNotFound()) resolve(nil);
        else reject(@"E_LEVELDB_GET_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

- (void)del:(NSString *)dbName key:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        std::string db_path_str([[self getDbFullPath:dbName] UTF8String]);
        if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
            reject(@"E_DB_NOT_OPEN", @"Database not open", nil);
            return;
        }
        leveldb::WriteOptions writeOptions;
        writeOptions.sync = true;
        leveldb::Status status = _dbInstances[db_path_str]->Delete(writeOptions, to_std_string(key));
        if (status.ok()) {
            resolve(@(true));
        } else {
            reject(@"E_LEVELDB_DELETE_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
        }
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

- (void)batch:(NSString *)dbName operations:(NSArray *)operations resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        std::string db_path_str([[self getDbFullPath:dbName] UTF8String]);
        if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
            reject(@"E_DB_NOT_OPEN", @"Database not open", nil);
            return;
        }
        leveldb::WriteBatch batch;
        for (id op_id in operations) {
            if (![op_id isKindOfClass:[NSDictionary class]]) continue;
            NSDictionary *op = (NSDictionary *)op_id;
            NSString *type = op[@"type"];
            std::string key_str = to_std_string(op[@"key"]);
            if ([type isEqualToString:@"put"]) {
                batch.Put(key_str, to_std_string(op[@"value"]));
            } else if ([type isEqualToString:@"del"]) {
                batch.Delete(key_str);
            }
        }
        leveldb::WriteOptions writeOptions;
        writeOptions.sync = true;
        leveldb::Status status = _dbInstances[db_path_str]->Write(writeOptions, &batch);
        if (status.ok()) {
            resolve(@(true));
        } else {
            reject(@"E_LEVELDB_BATCH_FAILED", [NSString stringWithUTF8String:status.ToString().c_str()], nil);
        }
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

- (void)iterator_create:(NSString *)dbName optionsJSON:(NSString *)optionsJSON resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        std::string db_path_str([[self getDbFullPath:dbName] UTF8String]);
        if (_dbInstances.find(db_path_str) == _dbInstances.end()) {
            reject(@"E_DB_NOT_OPEN", @"Database not open", nil);
            return;
        }

        NSError *error = nil;
        NSData *data = [optionsJSON dataUsingEncoding:NSUTF8StringEncoding];
        NSDictionary *options = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];

        if (error) {
            reject(@"E_JSON_PARSE", @"Failed to parse options JSON", error);
            return;
        }

        leveldb::DB *db = _dbInstances[db_path_str];
        leveldb::Iterator* it = db->NewIterator(leveldb::ReadOptions());

        bool reverse = NO;
        if (options[@"reverse"] && options[@"reverse"] != [NSNull null]) {
            reverse = [options[@"reverse"] boolValue];
        }

        if (reverse) {
            it->SeekToLast();
            id lt_obj = options[@"lt"];
            if (lt_obj && [lt_obj isKindOfClass:[NSString class]]) {
                it->Seek(to_std_string(lt_obj));
                if (it->Valid() && it->key().ToString() >= to_std_string(lt_obj)) it->Prev();
            }
        } else {
            it->SeekToFirst();
            id gte_obj = options[@"gte"];
            if (gte_obj && [gte_obj isKindOfClass:[NSString class]]) {
                it->Seek(to_std_string(gte_obj));
            }
            id gt_obj = options[@"gt"];
            if (gt_obj && [gt_obj isKindOfClass:[NSString class]]) {
                it->Seek(to_std_string(gt_obj));
                if (it->Valid() && it->key().ToString() == to_std_string(gt_obj)) it->Next();
            }
        }

        NSString *iteratorId = [[NSUUID UUID] UUIDString];
        _iteratorInstances[[iteratorId UTF8String]] = new IteratorWrapper(it, options);
        resolve(iteratorId);
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

- (void)iterator_next:(NSString *)iteratorId count:(double)count resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        std::string iterator_id_str = to_std_string(iteratorId);
        if (_iteratorInstances.find(iterator_id_str) == _iteratorInstances.end()) {
            reject(@"E_ITERATOR_NOT_FOUND", @"Iterator not found", nil);
            return;
        }
        IteratorWrapper* wrapper = _iteratorInstances[iterator_id_str];
        leveldb::Iterator* it = wrapper->iterator;
        NSDictionary* opts = wrapper->options;

        NSMutableArray *result = [NSMutableArray array];
        int num = (int)count;

        id lt_obj = opts[@"lt"];
        id lte_obj = opts[@"lte"];
        bool reverse = [opts[@"reverse"] boolValue];

        for (int i = 0; i < num && it->Valid(); ) {
            std::string currentKey = it->key().ToString();

            if (reverse) {
                // Reverse mode checks: gt, gte
                id gt_obj = opts[@"gt"];
                if (gt_obj && gt_obj != [NSNull null] && currentKey <= to_std_string(gt_obj)) {
                    break;
                }
                id gte_obj = opts[@"gte"];
                if (gte_obj && gte_obj != [NSNull null] && currentKey < to_std_string(gte_obj)) {
                    break;
                }
            } else {
                // Forward mode checks: lt, lte
                if (lt_obj && lt_obj != [NSNull null] && currentKey >= to_std_string(lt_obj)) {
                    break;
                }
                if (lte_obj && lte_obj != [NSNull null] && currentKey > to_std_string(lte_obj)) {
                    break;
                }
            }

            NSArray *entry = @[
                [NSString stringWithUTF8String:currentKey.c_str()],
                [NSString stringWithUTF8String:it->value().ToString().c_str()]
            ];
            [result addObject:entry];
            i++;

            if (reverse) it->Prev(); else it->Next();
        }

        if ([result count] > 0) {
            NSData *jsonData = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
            NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
            resolve(jsonString);
        } else {
            resolve(nil);
        }
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

- (void)iterator_seek:(NSString *)iteratorId key:(NSString *)key
{
    @try {
        std::string iterator_id_str = to_std_string(iteratorId);
        if (_iteratorInstances.find(iterator_id_str) != _iteratorInstances.end()) {
            _iteratorInstances[iterator_id_str]->iterator->Seek(to_std_string(key));
        }
    } @catch (NSException *exception) {
        NSLog(@"[LevelDB] iterator_seek failed: %@", exception.reason);
    }
}

- (void)iterator_close:(NSString *)iteratorId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
    @try {
        std::string iterator_id_str = to_std_string(iteratorId);
        auto it = _iteratorInstances.find(iterator_id_str);
        if (it != _iteratorInstances.end()) {
            delete it->second;
            _iteratorInstances.erase(it);
        }
        resolve(@(true));
    } @catch (NSException *exception) {
        reject(exception.name, exception.reason, nil);
    }
}

@end
