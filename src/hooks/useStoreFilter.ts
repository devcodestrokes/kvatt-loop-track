import { useState, useEffect, useCallback } from 'react';
import { Store } from '@/types/analytics';

const STORAGE_KEY = 'kvatt_selected_stores';

export function useStoreFilter(stores: Store[]) {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedStores(parsed);
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    setIsInitialized(true);
  }, []);

  // When stores load, validate selected stores exist
  useEffect(() => {
    if (stores.length > 0 && isInitialized) {
      const storeIds = stores.map(s => s.id);
      
      // If no stores selected or all selected stores are invalid, select all
      if (selectedStores.length === 0) {
        setSelectedStores(storeIds);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storeIds));
      } else {
        // Filter to only valid store IDs
        const validSelected = selectedStores.filter(id => storeIds.includes(id));
        if (validSelected.length !== selectedStores.length) {
          setSelectedStores(validSelected.length > 0 ? validSelected : storeIds);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validSelected.length > 0 ? validSelected : storeIds));
        }
      }
    }
  }, [stores, isInitialized]);

  const toggleStore = useCallback((storeId: string) => {
    setSelectedStores(prev => {
      const newSelection = prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSelection));
      return newSelection;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = stores.map(s => s.id);
    setSelectedStores(allIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
  }, [stores]);

  const unselectAll = useCallback(() => {
    setSelectedStores([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }, []);

  const isAllSelected = stores.length > 0 && selectedStores.length === stores.length;
  const isNoneSelected = selectedStores.length === 0;

  return {
    selectedStores,
    toggleStore,
    selectAll,
    unselectAll,
    isAllSelected,
    isNoneSelected,
    isInitialized,
  };
}
