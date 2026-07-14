import type { ERPDatabase } from './schema'
import { ERP_DB_KEY, ERP_DB_VERSION } from './schema'
import { createSeedDatabase } from './seed-data'
import { migrateDatabase } from './migrations'

function deepClone<T>(value: T): T {
  return structuredClone(value)
}

export function readRawDatabase(): ERPDatabase | null {
  try {
    const raw = localStorage.getItem(ERP_DB_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ERPDatabase
  } catch {
    return null
  }
}

export function writeRawDatabase(db: ERPDatabase): void {
  const next: ERPDatabase = {
    ...db,
    meta: {
      ...db.meta,
      updatedAt: new Date().toISOString(),
    },
  }
  localStorage.setItem(ERP_DB_KEY, JSON.stringify(next))
}

export function getDatabase(): ERPDatabase {
  let db = readRawDatabase()
  if (!db) {
    db = createSeedDatabase()
    writeRawDatabase(db)
    return deepClone(db)
  }
  const migrated = migrateDatabase(db)
  if (migrated.meta.version !== db.meta.version) {
    writeRawDatabase(migrated)
  }
  return deepClone(migrated)
}

export function saveDatabase(db: ERPDatabase): void {
  writeRawDatabase(db)
}

export function resetDatabase(): ERPDatabase {
  const seeded = createSeedDatabase()
  writeRawDatabase(seeded)
  return deepClone(seeded)
}

export function withTransaction<T>(
  work: (draft: ERPDatabase) => T,
): T {
  const draft = getDatabase()
  const result = work(draft)
  saveDatabase(draft)
  return result
}

export function assertDbVersion(db: ERPDatabase): void {
  if (db.meta.version > ERP_DB_VERSION) {
    throw new Error('Database version is newer than this app supports. Please refresh.')
  }
}
