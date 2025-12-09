export interface Store {
  id: string;
  name: string;
}

export interface AnalyticsData {
  store: string;
  total_checkouts: number;
  opt_ins: number;
  opt_outs: number;
}

export interface AnalyticsResponse {
  status: number;
  data: AnalyticsData[];
}

export interface StoresResponse {
  status: number;
  data: string[];
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface MetricCardData {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'amber' | 'red';
}
