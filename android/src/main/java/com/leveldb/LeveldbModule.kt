package com.leveldb

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import org.iq80.leveldb.DB
import org.iq80.leveldb.Options
import org.iq80.leveldb.impl.Iq80DBFactory
import java.io.File
import java.util.*
import org.iq80.leveldb.WriteBatch
import org.json.JSONArray

@ReactModule(name = LeveldbModule.NAME)
class LeveldbModule(reactContext: ReactApplicationContext) :
  NativeLeveldbSpec(reactContext) {

  private val dbInstances = mutableMapOf<String, DB>()
  private val iteratorInstances = mutableMapOf<String, org.iq80.leveldb.DBIterator>()

  override fun getName(): String {
    return NAME
  }

  override fun getVersion(): String {
    return "1.22.0"
  }

  private fun getDbPath(dbName: String): File {
    return File(reactApplicationContext.filesDir, dbName)
  }

  override fun open(name: String, promise: Promise) {
    try {
      val dbPath = getDbPath(name)
      if (dbInstances.containsKey(dbPath.absolutePath)) {
        promise.resolve(true)
        return
      }
      val options = Options().createIfMissing(true)
      val db = Iq80DBFactory.factory.open(dbPath, options)
      dbInstances[dbPath.absolutePath] = db
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_LEVELDB_OPEN_FAILED", e)
    }
  }

  override fun close(dbName: String, promise: Promise) {
    try {
      val dbPath = getDbPath(dbName).absolutePath
      val db = dbInstances.remove(dbPath)
      db?.close()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_LEVELDB_CLOSE_FAILED", e)
    }
  }

  override fun put(dbName: String, key: String, value: String, promise: Promise) {
    try {
      val db = dbInstances[getDbPath(dbName).absolutePath]
      if (db == null) {
        promise.reject("E_DB_NOT_OPEN", "Database not open")
        return
      }
      db.put(key.toByteArray(), value.toByteArray())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_LEVELDB_PUT_FAILED", e)
    }
  }

  override fun get(dbName: String, key: String, promise: Promise) {
    try {
      val db = dbInstances[getDbPath(dbName).absolutePath]
      if (db == null) {
        promise.reject("E_DB_NOT_OPEN", "Database not open")
        return
      }
      val value = db.get(key.toByteArray())
      promise.resolve(if (value == null) null else String(value))
    } catch (e: Exception) {
      promise.reject("E_LEVELDB_GET_FAILED", e)
    }
  }

  override fun del(dbName: String, key: String, promise: Promise) {
    try {
      val db = dbInstances[getDbPath(dbName).absolutePath]
      if (db == null) {
        promise.reject("E_DB_NOT_OPEN", "Database not open")
        return
      }
      db.delete(key.toByteArray())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_LEVELDB_DELETE_FAILED", e)
    }
  }

  override fun batch(dbName: String, operations: ReadableArray, promise: Promise) {
    try {
      val db = dbInstances[getDbPath(dbName).absolutePath]
      if (db == null) {
        promise.reject("E_DB_NOT_OPEN", "Database not open")
        return
      }
      val batch = db.createWriteBatch()
      for (i in 0 until operations.size()) {
        val op = operations.getMap(i)
        if (op == null) continue
        val type = op.getString("type")
        val key = op.getString("key")?.toByteArray()
        if (key == null) continue

        if (type == "put") {
          val value = op.getString("value")?.toByteArray()
          if (value != null) batch.put(key, value)
        } else if (type == "del") {
          batch.delete(key)
        }
      }
      db.write(batch)
      batch.close()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_LEVELDB_BATCH_FAILED", e)
    }
  }

  override fun iterator_create(dbName: String, optionsJSON: String, promise: Promise) {
    try {
      val db = dbInstances[getDbPath(dbName).absolutePath]
      if (db == null) {
        promise.reject("E_DB_NOT_OPEN", "Database not open")
        return
      }
      
      val options = org.json.JSONObject(optionsJSON)
      val iterator = db.iterator()
      val reverse = options.optBoolean("reverse", false)

      if (reverse) {
        iterator.seekToLast()
        if (options.has("lt")) {
            val ltKey = options.getString("lt")
            iterator.seek(ltKey.toByteArray())
            if (iterator.hasNext() && String(iterator.peekNext().key) >= ltKey) {
                iterator.prev()
            }
        }
      } else {
        iterator.seekToFirst()
        if (options.has("gte")) {
            iterator.seek(options.getString("gte").toByteArray())
        }
        if (options.has("gt")) {
            val gtKey = options.getString("gt")
            iterator.seek(gtKey.toByteArray())
            if (iterator.hasNext() && String(iterator.peekNext().key) == gtKey) {
                iterator.next()
            }
        }
      }

      val iteratorId = UUID.randomUUID().toString()
      iteratorInstances[iteratorId] = iterator
      promise.resolve(iteratorId)
    } catch (e: Exception) {
      promise.reject("E_ITERATOR_CREATE_FAILED", e)
    }
  }

  override fun iterator_next(iteratorId: String, count: Double, promise: Promise) {
    try {
      val iterator = iteratorInstances[iteratorId]
      if (iterator == null) {
        promise.reject("E_ITERATOR_NOT_FOUND", "Iterator not found")
        return
      }
      val result = JSONArray()
      for (i in 0 until count.toInt()) {
        if (iterator.hasNext()) {
          val entry = iterator.next()
          val item = JSONArray()
          item.put(String(entry.key))
          item.put(String(entry.value))
          result.put(item)
        } else {
          break
        }
      }
      if (result.length() > 0) {
        promise.resolve(result.toString())
      } else {
        promise.resolve(null)
      }
    } catch (e: Exception) {
      promise.reject("E_ITERATOR_NEXT_FAILED", e)
    }
  }

  override fun iterator_seek(iteratorId: String, key: String) {
    try {
      val iterator = iteratorInstances[iteratorId]
      iterator?.seek(key.toByteArray())
    } catch (e: Exception) {
      // Log error, but don't crash
      System.err.println("[LevelDB] iterator_seek failed: " + e.message)
    }
  }

  override fun iterator_close(iteratorId: String, promise: Promise) {
    try {
      val iterator = iteratorInstances.remove(iteratorId)
      iterator?.close()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_ITERATOR_CLOSE_FAILED", e)
    }
  }

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    for (db in dbInstances.values) {
      db.close()
    }
    dbInstances.clear()
    for (iterator in iteratorInstances.values) {
      iterator.close()
    }
    iteratorInstances.clear()
  }

  companion object {
    const val NAME = "Leveldb"
  }
}
