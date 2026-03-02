/**
 * useUserPreferences - localStorage-based preferences for import defaults
 *
 * Stores per-integration default workspace selections so users don't have to
 * re-select their preferred workspace every time they import.
 *
 * @pattern localStorage persistence with React state sync
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'callvault-user-preferences'

type IntegrationKey = 'youtube' | 'zoom' | 'google_meet' | 'fathom'

interface UserPreferences {
  /** Default workspace ID per integration for imports */
  defaultImportWorkspace: Partial<Record<IntegrationKey, string>>
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultImportWorkspace: {},
}

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(stored)
    // Handle migration from old key if it exists
    const legacyVaults = (parsed as any).defaultImportVault || {}

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      defaultImportWorkspace: {
        ...DEFAULT_PREFERENCES.defaultImportWorkspace,
        ...legacyVaults,
        ...(parsed.defaultImportWorkspace || {}),
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

  const getDefaultWorkspace = useCallback(
    (integration: IntegrationKey): string | undefined => {
      return preferences.defaultImportWorkspace[integration]
    },
    [preferences]
  )

  const setDefaultWorkspace = useCallback(
    (integration: IntegrationKey, workspaceId: string) => {
      setPreferences((prev) => {
        const next: UserPreferences = {
          ...prev,
          defaultImportWorkspace: {
            ...prev.defaultImportWorkspace,
            [integration]: workspaceId,
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
    getDefaultWorkspace,
    setDefaultWorkspace,
  }
}
