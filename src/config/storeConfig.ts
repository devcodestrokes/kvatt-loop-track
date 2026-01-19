// Store configuration for analytics
// Controls which stores are included in Insights analysis

export interface StoreConfig {
  userId: number;
  name: string;
  prefix: string;
  isProduction: boolean; // Only production stores are included in analytics
}

// Manual mapping of user_ids to store configuration
// Only stores with isProduction: true will be included in Insights analysis
export const STORE_CONFIG: StoreConfig[] = [
  { userId: 12, name: 'TIRTIR UK', prefix: 'UKT', isProduction: true },
  { userId: 7, name: 'Store #', prefix: '#', isProduction: true },
  { userId: 17, name: 'Spain Store', prefix: 'SP', isProduction: true },
  { userId: 6, name: 'Development', prefix: 'DEV', isProduction: false },
  { userId: 9, name: 'Test Store USD', prefix: 'USD', isProduction: false },
  { userId: 20, name: 'Test Store 20', prefix: '#10', isProduction: false },
  { userId: 24, name: 'Test Store 24', prefix: '#10', isProduction: false },
  { userId: 26, name: 'Test Store 26', prefix: '#11', isProduction: false },
];

// Get production store user IDs for filtering
export function getProductionStoreIds(): number[] {
  return STORE_CONFIG.filter(s => s.isProduction).map(s => s.userId);
}

// Get store name by user_id
export function getStoreName(userId: number): string {
  const store = STORE_CONFIG.find(s => s.userId === userId);
  return store?.name || `Store ${userId}`;
}

// Check if a store is production
export function isProductionStore(userId: number): boolean {
  const store = STORE_CONFIG.find(s => s.userId === userId);
  return store?.isProduction ?? false;
}
