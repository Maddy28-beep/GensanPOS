import { useEffect, useMemo, useState } from 'react'

const storagePrefix = 'gensteel:draft:'

export function clearPersistentDrafts() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(storagePrefix))
      .forEach((key) => window.sessionStorage.removeItem(key))
  } catch {
    // Ignore storage failures.
  }
}

function readStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') {
    return initialValue
  }

  try {
    const rawValue = window.sessionStorage.getItem(`${storagePrefix}${key}`)
    return rawValue ? (JSON.parse(rawValue) as T) : initialValue
  } catch {
    return initialValue
  }
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const storageKey = useMemo(() => `${storagePrefix}${key}`, [key])
  const [value, setValue] = useState<T>(() => readStoredValue(key, initialValue))

  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // Draft persistence is a convenience only. If storage is unavailable, keep the app usable.
    }
  }, [storageKey, value])

  const clearValue = () => {
    try {
      window.sessionStorage.removeItem(storageKey)
    } catch {
      // Ignore storage failures.
    }
    setValue(initialValue)
  }

  return [value, setValue, clearValue] as const
}
