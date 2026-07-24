import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { isChunkLoadError, recoverFromChunkError } from './chunk-recovery'

type ModuleDefault<T> = { default: T }

export async function importWithChunkRetry<T>(
  factory: () => Promise<T>,
): Promise<T> {
  try {
    return await factory()
  } catch (error) {
    if (!isChunkLoadError(error)) throw error

    const result = await recoverFromChunkError()
    if (result === 'reloaded') {
      return new Promise<T>(() => {
        // page reload in progress
      })
    }

    throw error
  }
}

export function lazyWithRetry<T extends ComponentType>(
  factory: () => Promise<ModuleDefault<T>>,
): LazyExoticComponent<T> {
  return lazy(() => importWithChunkRetry(factory))
}
