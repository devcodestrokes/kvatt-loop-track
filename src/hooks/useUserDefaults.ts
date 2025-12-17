import { useState, useEffect, useCallback } from 'react';
import { startOfWeek, subDays } from 'date-fns';

const STORAGE_KEY = 'kvatt_user_defaults';

export type DateRangePreset = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'since_last_monday' | 'this_month';

export interface UserDefaults {
  dateRangePreset: DateRangePreset;
  weekStartsOnMonday: boolean;
}

const DEFAULT_VALUES: UserDefaults = {
  dateRangePreset: 'since_last_monday',
  weekStartsOnMonday: true,
};

export function useUserDefaults() {
  const [defaults, setDefaults] = useState<UserDefaults>(DEFAULT_VALUES);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDefaults({ ...DEFAULT_VALUES, ...parsed });
      } catch {
        // Invalid JSON, use defaults
      }
    }
    setIsInitialized(true);
  }, []);

  const updateDefaults = useCallback((updates: Partial<UserDefaults>) => {
    setDefaults(prev => {
      const newDefaults = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newDefaults));
      return newDefaults;
    });
  }, []);

  // Get date range based on preset
  const getDateRangeFromPreset = useCallback((preset: DateRangePreset) => {
    const now = new Date();
    const weekStart = defaults.weekStartsOnMonday ? 1 : 0;

    switch (preset) {
      case 'last_7_days':
        return { from: subDays(now, 6), to: now };
      case 'last_14_days':
        return { from: subDays(now, 13), to: now };
      case 'last_30_days':
        return { from: subDays(now, 29), to: now };
      case 'since_last_monday':
        return { from: startOfWeek(now, { weekStartsOn: weekStart }), to: now };
      case 'this_month':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
      default:
        return { from: subDays(now, 29), to: now };
    }
  }, [defaults.weekStartsOnMonday]);

  const getDefaultDateRange = useCallback(() => {
    return getDateRangeFromPreset(defaults.dateRangePreset);
  }, [defaults.dateRangePreset, getDateRangeFromPreset]);

  return {
    defaults,
    updateDefaults,
    getDefaultDateRange,
    getDateRangeFromPreset,
    isInitialized,
  };
}

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  last_7_days: 'Last 7 days',
  last_14_days: 'Last 14 days',
  last_30_days: 'Last 30 days',
  since_last_monday: 'Since last Monday',
  this_month: 'This month',
};
