// Widget configuration per store
// This is manually maintained until we have a database field for widget types

export type WidgetType = 'popup' | 'inline' | 'cart-drawer' | 'checkout' | 'none';

export interface WidgetConfig {
  type: WidgetType;
  version: string;
  label: string;
}

// Manual mapping of store domains to their active widget configuration
export const STORE_WIDGET_CONFIG: Record<string, WidgetConfig> = {
  // Add store mappings here as needed
  // Example:
  // 'store-name.myshopify.com': { type: 'popup', version: '2.1', label: 'Popup v2.1' },
};

export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  'popup': 'Popup Widget',
  'inline': 'Inline Widget', 
  'cart-drawer': 'Cart Drawer',
  'checkout': 'Checkout Widget',
  'none': 'No Widget',
};

export function getWidgetConfig(storeDomain: string): WidgetConfig | null {
  return STORE_WIDGET_CONFIG[storeDomain] || null;
}

export function getWidgetLabel(storeDomain: string): string {
  const config = getWidgetConfig(storeDomain);
  if (!config) return 'Not configured';
  return config.label || `${WIDGET_TYPE_LABELS[config.type]} v${config.version}`;
}
