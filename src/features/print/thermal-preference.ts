import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage'
import type { ThermalWidth } from './print.types'

export function getSavedThermalWidth(): ThermalWidth {
  const saved = getStorageItem<ThermalWidth | null>(STORAGE_KEYS.posReceiptWidth, null)
  return saved === '58mm' || saved === '80mm' ? saved : '80mm'
}

export function saveThermalWidth(width: ThermalWidth) {
  setStorageItem(STORAGE_KEYS.posReceiptWidth, width)
}
