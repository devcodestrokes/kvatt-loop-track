import { useMemo } from 'react';
import { MapPin } from 'lucide-react';

interface CountryData {
  name: string;
  total: number;
  optIn: number;
  optInRate: string;
}

interface GeographicHeatmapProps {
  countries: CountryData[];
}

// Get color based on opt-in rate (0-100%)
const getHeatmapColor = (rate: number): string => {
  // Color scale from cool (low) to warm (high)
  if (rate >= 20) return 'bg-emerald-500 text-white';
  if (rate >= 15) return 'bg-emerald-400 text-white';
  if (rate >= 12) return 'bg-teal-400 text-white';
  if (rate >= 10) return 'bg-cyan-400 text-white';
  if (rate >= 8) return 'bg-sky-400 text-white';
  if (rate >= 6) return 'bg-blue-400 text-white';
  if (rate >= 4) return 'bg-indigo-300 text-indigo-900';
  if (rate >= 2) return 'bg-violet-200 text-violet-900';
  return 'bg-slate-200 text-slate-700';
};

const getHeatmapBorderColor = (rate: number): string => {
  if (rate >= 20) return 'ring-emerald-600';
  if (rate >= 15) return 'ring-emerald-500';
  if (rate >= 12) return 'ring-teal-500';
  if (rate >= 10) return 'ring-cyan-500';
  if (rate >= 8) return 'ring-sky-500';
  if (rate >= 6) return 'ring-blue-500';
  if (rate >= 4) return 'ring-indigo-400';
  if (rate >= 2) return 'ring-violet-300';
  return 'ring-slate-300';
};

// Country flag emoji mapping for common countries
const countryFlags: Record<string, string> = {
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  'USA': '🇺🇸',
  'Canada': '🇨🇦',
  'Australia': '🇦🇺',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪',
  'Ireland': '🇮🇪',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Denmark': '🇩🇰',
  'Finland': '🇫🇮',
  'Austria': '🇦🇹',
  'Switzerland': '🇨🇭',
  'Portugal': '🇵🇹',
  'Greece': '🇬🇷',
  'Poland': '🇵🇱',
  'Czech Republic': '🇨🇿',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'China': '🇨🇳',
  'India': '🇮🇳',
  'Brazil': '🇧🇷',
  'Mexico': '🇲🇽',
  'South Africa': '🇿🇦',
  'New Zealand': '🇳🇿',
  'Singapore': '🇸🇬',
  'UAE': '🇦🇪',
  'United Arab Emirates': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'Israel': '🇮🇱',
  'Turkey': '🇹🇷',
  'Russia': '🇷🇺',
  'Ukraine': '🇺🇦',
  'Hong Kong': '🇭🇰',
  'Taiwan': '🇹🇼',
  'Malaysia': '🇲🇾',
  'Thailand': '🇹🇭',
  'Vietnam': '🇻🇳',
  'Philippines': '🇵🇭',
  'Indonesia': '🇮🇩',
  'Argentina': '🇦🇷',
  'Chile': '🇨🇱',
  'Colombia': '🇨🇴',
  'Egypt': '🇪🇬',
  'Morocco': '🇲🇦',
  'Kenya': '🇰🇪',
  'Nigeria': '🇳🇬',
  'Isle of Man': '🇮🇲',
  'Isle Of Man': '🇮🇲',
  'Jersey': '🇯🇪',
  'Guernsey': '🇬🇬',
  'Gibraltar': '🇬🇮',
};

const getFlag = (country: string): string => {
  return countryFlags[country] || '🌍';
};

export const GeographicHeatmap = ({ countries }: GeographicHeatmapProps) => {
  const { sortedCountries, minRate, maxRate, avgRate } = useMemo(() => {
    const sorted = [...countries]
      .filter(c => c.total >= 10) // Only show countries with meaningful data
      .sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate));
    
    const rates = sorted.map(c => parseFloat(c.optInRate));
    return {
      sortedCountries: sorted,
      minRate: rates.length ? Math.min(...rates) : 0,
      maxRate: rates.length ? Math.max(...rates) : 0,
      avgRate: rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) : '0',
    };
  }, [countries]);

  if (sortedCountries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No geographic data available</p>
        <p className="text-xs mt-1">Sync orders to see the heatmap</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Opt-in Rate:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-slate-200" />
            <span className="text-xs text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-4 rounded-l bg-violet-200" />
            <div className="w-3 h-4 bg-indigo-300" />
            <div className="w-3 h-4 bg-blue-400" />
            <div className="w-3 h-4 bg-sky-400" />
            <div className="w-3 h-4 bg-cyan-400" />
            <div className="w-3 h-4 bg-teal-400" />
            <div className="w-3 h-4 rounded-r bg-emerald-500" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">High</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Range: <span className="font-medium text-foreground">{minRate.toFixed(1)}% - {maxRate.toFixed(1)}%</span>
          </span>
          <span className="text-muted-foreground">
            Avg: <span className="font-medium text-primary">{avgRate}%</span>
          </span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {sortedCountries.map((country, i) => {
          const rate = parseFloat(country.optInRate);
          const colorClass = getHeatmapColor(rate);
          const ringClass = getHeatmapBorderColor(rate);
          const isTopPerformer = i < 3;
          
          return (
            <div
              key={country.name}
              className={`
                relative p-3 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-default
                ${colorClass}
                ${isTopPerformer ? `ring-2 ${ringClass}` : ''}
              `}
              title={`${country.name}: ${country.optInRate}% opt-in rate (${country.total.toLocaleString()} orders)`}
            >
              {isTopPerformer && (
                <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 text-amber-900 text-xs font-bold flex items-center justify-center shadow">
                  {i + 1}
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-lg">{getFlag(country.name)}</span>
                <span className="text-xs font-medium truncate flex-1" title={country.name}>
                  {country.name}
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">
                {country.optInRate}%
              </div>
              <div className="text-xs opacity-80">
                {country.total.toLocaleString()} orders
              </div>
            </div>
          );
        })}
      </div>

      {/* Top performers highlight */}
      {sortedCountries.length >= 3 && (
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            🏆 Top Performing Countries
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {sortedCountries.slice(0, 3).map((country, i) => (
              <div key={country.name} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>{getFlag(country.name)}</span>
                    <span className="text-sm font-medium truncate">{country.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {country.optInRate}% • {country.total.toLocaleString()} orders
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
