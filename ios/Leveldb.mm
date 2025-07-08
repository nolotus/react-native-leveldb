#import "Leveldb.h"
#import <leveldb/db.h>
#import <leveldb/env.h>
#import <leveldb/cache.h>
#import <leveldb/write_batch.h>
#import <leveldb/filter_policy.h>
#import <leveldb/comparator.h>

@implementation Leveldb
RCT_EXPORT_MODULE()

- (NSString *)getVersion {
    return [NSString stringWithFormat:@"%d.%d", leveldb::kMajorVersion, leveldb::kMinorVersion];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeLeveldbSpecJSI>(params);
}

@end
