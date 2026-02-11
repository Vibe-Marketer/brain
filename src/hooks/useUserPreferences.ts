/**
 * useUserPreferences - localStorage-based preferences for import defaults
 *
 * Stores per-integration default vault selections so users don't have to
 * re-select their preferred vault every time they import.
 *
 * @pattern localStorage persistence with React state sync
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'callvault-user-preferences'

type IntegrationKey = 'youtube' | 'zoom' | 'google_meet' | 'fathom'

interface UserPreferences {
  /** Default vault ID per integration for imports */
  defaultImportVault: Partial<Record<IntegrationKey, string>>
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultImportVault: {},
}

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(stored)
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      defaultImportVault: {
        ...DEFAULT_PREFERENCES.defaultImportVault,
        ...(parsed.defaultImportVault || {}),
      },
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences)

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setPreferences(loadPreferences())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const getDefaultVault = useCallback(
    (integration: IntegrationKey): string | undefined => {
      return preferences.defaultImportVault[integration]
    },
    [preferences]
  )

  const setDefaultVault = useCallback(
    (integration: IntegrationKey, vaultId: string) => {
      setPreferences((prev) => {
        const next: UserPreferences = {
          ...prev,
          defaultImportVault: {
            ...prev.defaultImportVault,
            [integration]: vaultId,
          },
        }
        savePreferences(next)
        return next
      })
    },
    []
  )

  return {
    preferences,
    getDefaultVault,
    setDefaultVault,
  }
}
