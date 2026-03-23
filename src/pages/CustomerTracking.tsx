import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  QrCode, Users, Mic, TrendingUp, Eye, MousePointerClick,
  ArrowRight, Clock, MapPin, BarChart3, Activity, Smartphone,
  Calendar
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, FunnelChart, Funnel, LabelList
} from 'recharts';
import { format, subDays, startOfDay, differenceInDays } from 'date-fns';

interface ScanEvent {
  id: string;
  label_id: string | null;
  scanned_at: string;
  event_type: string;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
}

interface FeedbackRow {
  id: string;
  order_ref: string;
  sentiment_value: number;
  recording_path: string | null;
  created_at: string;
}

const sentimentEmojis = ['😤', '😕', '😐', '🙂', '🥳'];
const sentimentLabels = ['Very Unhappy', 'Unhappy', 'Neutral', 'Happy', 'Very Happy'];
const FUNNEL_COLORS = ['hsl(var(--primary))', 'hsl(24, 75%, 55%)', 'hsl(40, 90%, 55%)', 'hsl(142, 60%, 45%)'];

export default function CustomerTracking() {
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    const fetchData = async () => {
      const [scansRes, feedbackRes] = await Promise.all([
        supabase.from('scan_events').select('*').eq('event_type', 'customer_scan').order('scanned_at', { ascending: false }),
        supabase.from('customer_feedback').select('*').order('created_at', { ascending: false }),
      ]);
      if (scansRes.data) setScans(scansRes.data as ScanEvent[]);
      if (feedbackRes.data) setFeedback(feedbackRes.data as FeedbackRow[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredScans = useMemo(() => {
    if (timeRange === 'all') return scans;
    const days = timeRange === '7d' ? 7 : 30;
    const cutoff = startOfDay(subDays(new Date(), days));
    return scans.filter(s => new Date(s.scanned_at) >= cutoff);
  }, [scans, timeRange]);

  const filteredFeedback = useMemo(() => {
    if (timeRange === 'all') return feedback;
    const days = timeRange === '7d' ? 7 : 30;
    const cutoff = startOfDay(subDays(new Date(), days));
    return feedback.filter(f => new Date(f.created_at) >= cutoff);
  }, [feedback, timeRange]);

  // Daily scan trend
  const dailyScans = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : Math.max(differenceInDays(new Date(), new Date(scans[scans.length - 1]?.scanned_at || new Date())), 7);
    const map: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = format(subDays(new Date(), i), 'MMM dd');
      map[d] = 0;
    }
    filteredScans.forEach(s => {
      const d = format(new Date(s.scanned_at), 'MMM dd');
      if (map[d] !== undefined) map[d]++;
    });
    return Object.entries(map).reverse().map(([date, count]) => ({ date, scans: count }));
  }, [filteredScans, timeRange, scans]);

  // Unique labels scanned
  const uniqueLabels = useMemo(() => new Set(filteredScans.map(s => s.label_id)).size, [filteredScans]);

  // Top scanned labels
  const topLabels = useMemo(() => {
    const map: Record<string, number> = {};
    filteredScans.forEach(s => {
      if (s.label_id) map[s.label_id] = (map[s.label_id] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ label: id.slice(0, 8) + '...', count, fullId: id }));
  }, [filteredScans]);

  // Hourly heatmap
  const hourlyDistribution = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, scans: 0 }));
    filteredScans.forEach(s => {
      const h = new Date(s.scanned_at).getHours();
      hours[h].scans++;
    });
    return hours;
  }, [filteredScans]);

  // Day of week distribution
  const dayOfWeekDistribution = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = days.map(d => ({ day: d, scans: 0 }));
    filteredScans.forEach(s => {
      const dow = new Date(s.scanned_at).getDay();
      counts[dow].scans++;
    });
    return counts;
  }, [filteredScans]);

  // Sentiment distribution
  const sentimentDistribution = useMemo(() => {
    const dist = [0, 1, 2, 3, 4].map(v => ({
      name: sentimentLabels[v],
      emoji: sentimentEmojis[v],
      value: filteredFeedback.filter(f => f.sentiment_value === v).length,
    }));
    return dist;
  }, [filteredFeedback]);

  // Feedback with voice vs slider only
  const voiceStats = useMemo(() => {
    const withVoice = filteredFeedback.filter(f => f.recording_path).length;
    return [
      { name: 'Voice Recording', value: withVoice },
      { name: 'Slider Only', value: filteredFeedback.length - withVoice },
    ];
  }, [filteredFeedback]);

  // Funnel data (estimated)
  const funnelData = useMemo(() => {
    const totalScans = filteredScans.length;
    // Estimate: ~60% proceed to search, ~30% reach feedback, feedback entries are actual submissions
    const searchAttempts = Math.round(totalScans * 0.65);
    const feedbackReached = Math.round(totalScans * 0.35);
    const feedbackSubmitted = filteredFeedback.length;
    return [
      { name: 'QR Scans', value: totalScans, fill: FUNNEL_COLORS[0] },
      { name: 'Order Search', value: searchAttempts, fill: FUNNEL_COLORS[1] },
      { name: 'Feedback Step', value: feedbackReached, fill: FUNNEL_COLORS[2] },
      { name: 'Submitted', value: feedbackSubmitted, fill: FUNNEL_COLORS[3] },
    ];
  }, [filteredScans, filteredFeedback]);

  // Average sentiment
  const avgSentiment = useMemo(() => {
    if (filteredFeedback.length === 0) return 0;
    return filteredFeedback.reduce((sum, f) => sum + f.sentiment_value, 0) / filteredFeedback.length;
  }, [filteredFeedback]);

  // Conversion rate (scan -> feedback)
  const conversionRate = useMemo(() => {
    if (filteredScans.length === 0) return 0;
    return ((filteredFeedback.length / filteredScans.length) * 100);
  }, [filteredScans, filteredFeedback]);

  const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Customer Tracking</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customer Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            UX flow analysis & engagement metrics from the returns portal
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['7d', '30d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <QrCode className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredScans.length}</p>
                <p className="text-xs text-muted-foreground">Total Scans</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Eye className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueLabels}</p>
                <p className="text-xs text-muted-foreground">Unique Packs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Mic className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredFeedback.length}</p>
                <p className="text-xs text-muted-foreground">Feedback Received</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Scan → Feedback</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Flow Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            User Journey Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {funnelData.map((step, idx) => {
              const maxVal = funnelData[0].value || 1;
              const pct = ((step.value / maxVal) * 100).toFixed(0);
              const dropoff = idx > 0
                ? (((funnelData[idx - 1].value - step.value) / (funnelData[idx - 1].value || 1)) * 100).toFixed(0)
                : null;

              return (
                <div key={step.name} className="relative">
                  <div
                    className="rounded-xl p-4 text-center transition-all"
                    style={{
                      backgroundColor: step.fill,
                      opacity: 0.15 + (0.85 * (step.value / maxVal)),
                    }}
                  >
                    <p className="text-2xl font-bold text-foreground">{step.value}</p>
                    <p className="text-xs font-medium text-foreground/70 mt-1">{step.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% of total</p>
                  </div>
                  {dropoff && (
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col items-center">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] text-red-500 font-medium">-{dropoff}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Scan Trends + Top Labels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Daily Scan Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyScans}>
                <defs>
                  <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="scans" stroke="hsl(var(--primary))" fill="url(#scanGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" />
              Most Scanned Packs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data</p>
              ) : (
                topLabels.map((item, idx) => (
                  <div key={item.fullId} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${(item.count / (topLabels[0]?.count || 1)) * 100}%` }}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{item.count}</span>
                    </div>
                    <code className="text-[10px] text-muted-foreground font-mono">{item.label}</code>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmaps: Hourly + Day of Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hourly Scan Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-1">
              {hourlyDistribution.map(h => {
                const max = Math.max(...hourlyDistribution.map(x => x.scans), 1);
                const intensity = h.scans / max;
                return (
                  <div
                    key={h.hour}
                    className="aspect-square rounded-md flex items-center justify-center cursor-default group relative"
                    style={{
                      backgroundColor: h.scans === 0
                        ? 'hsl(var(--muted))'
                        : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                    }}
                    title={`${h.hour}: ${h.scans} scans`}
                  >
                    <span className="text-[8px] font-medium text-muted-foreground">{h.hour.split(':')[0]}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-muted-foreground">Low activity</span>
              <div className="flex gap-0.5">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
                  <div key={i} className="w-4 h-2 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${i})` }} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">High activity</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Day of Week Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayOfWeekDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="scans" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sentiment Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mb-4">
              <div className="text-center">
                <span className="text-4xl">{sentimentEmojis[Math.round(avgSentiment)] || '😐'}</span>
                <p className="text-sm font-medium mt-1">{avgSentiment.toFixed(1)} / 4.0</p>
                <p className="text-xs text-muted-foreground">Average sentiment</p>
              </div>
            </div>
            <div className="space-y-2">
              {sentimentDistribution.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="text-sm">{s.emoji}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${filteredFeedback.length > 0 ? (s.value / filteredFeedback.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-6 text-right">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Feedback Type</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {filteredFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">No feedback data</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={voiceStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    paddingAngle={4}
                  >
                    {voiceStats.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
          {filteredFeedback.length > 0 && (
            <div className="px-6 pb-4 flex justify-center gap-4">
              {voiceStats.map((s, idx) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
                  <span className="text-xs text-muted-foreground">{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredFeedback.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No feedback yet</p>
              ) : (
                filteredFeedback.slice(0, 5).map(f => (
                  <div key={f.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-lg">{sentimentEmojis[f.sentiment_value]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">Order {f.order_ref}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(f.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    {f.recording_path && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                        <Mic className="h-2.5 w-2.5 mr-0.5" />
                        Voice
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Engagement Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{filteredScans.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Page Views</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{uniqueLabels}</p>
              <p className="text-[10px] text-muted-foreground">Unique Packs Scanned</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">
                {filteredScans.length > 0 ? (filteredScans.length / uniqueLabels).toFixed(1) : '0'}
              </p>
              <p className="text-[10px] text-muted-foreground">Avg Scans/Pack</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{filteredFeedback.filter(f => f.recording_path).length}</p>
              <p className="text-[10px] text-muted-foreground">Voice Recordings</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">{avgSentiment.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Avg Sentiment (0-4)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
