import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Region {
  name: string;
  total: number;
  optIn: number;
  optInRate: string;
}

interface City {
  name: string;
  total: number;
  optIn: number;
  optInRate: string;
  regions: Region[];
}

interface Country {
  name: string;
  total: number;
  optIn: number;
  optInRate: string;
  cities: City[];
}

interface CollapsibleHierarchyProps {
  hierarchy: Country[];
}

// Country flag emoji mapping
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
  'Isle of Man': '🇮🇲',
  'Isle Of Man': '🇮🇲',
  'Jersey': '🇯🇪',
  'Guernsey': '🇬🇬',
};

const getFlag = (country: string): string => countryFlags[country] || '🌍';

export const CollapsibleHierarchy = ({ hierarchy }: CollapsibleHierarchyProps) => {
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const toggleCountry = (countryName: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(countryName)) {
        next.delete(countryName);
      } else {
        next.add(countryName);
      }
      return next;
    });
  };

  const toggleCity = (cityKey: string) => {
    setExpandedCities(prev => {
      const next = new Set(prev);
      if (next.has(cityKey)) {
        next.delete(cityKey);
      } else {
        next.add(cityKey);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {hierarchy.slice(0, 10).map((country) => {
        const isCountryExpanded = expandedCountries.has(country.name);
        const hasCities = country.cities.length > 0;

        return (
          <div key={country.name} className="border border-border rounded-lg overflow-hidden bg-background">
            {/* Country Level - Clickable Header */}
            <button
              onClick={() => hasCities && toggleCountry(country.name)}
              className={`
                w-full flex items-center justify-between p-3 
                bg-primary/5 hover:bg-primary/10 transition-colors
                ${hasCities ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              <div className="flex items-center gap-2">
                {hasCities ? (
                  isCountryExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )
                ) : (
                  <span className="w-4" />
                )}
                <span className="text-lg">{getFlag(country.name)}</span>
                <span className="font-semibold text-left">{country.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{country.total.toLocaleString()} orders</span>
                <span className={`text-sm font-bold ${parseFloat(country.optInRate) > 10 ? 'text-primary' : ''}`}>
                  {country.optInRate}%
                </span>
              </div>
            </button>

            {/* Cities Level - Collapsible */}
            {isCountryExpanded && hasCities && (
              <div className="border-t border-border bg-muted/20">
                {country.cities.slice(0, 10).map((city) => {
                  const cityKey = `${country.name}-${city.name}`;
                  const isCityExpanded = expandedCities.has(cityKey);
                  const hasRegions = city.regions.length > 0;

                  return (
                    <div key={cityKey} className="border-b border-border last:border-b-0">
                      {/* City Header - Clickable */}
                      <button
                        onClick={() => hasRegions && toggleCity(cityKey)}
                        className={`
                          w-full flex items-center justify-between p-3 pl-8
                          hover:bg-muted/50 transition-colors
                          ${hasRegions ? 'cursor-pointer' : 'cursor-default'}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          {hasRegions ? (
                            isCityExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )
                          ) : (
                            <span className="w-3.5" />
                          )}
                          <span className="text-sm">🏙️</span>
                          <span className="text-sm font-medium text-left">{city.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{city.total.toLocaleString()}</span>
                          <span className={`text-sm font-medium ${parseFloat(city.optInRate) > 10 ? 'text-primary' : ''}`}>
                            {city.optInRate}%
                          </span>
                        </div>
                      </button>

                      {/* Regions Level - Collapsible */}
                      {isCityExpanded && hasRegions && (
                        <div className="bg-muted/30 border-t border-border">
                          {city.regions.slice(0, 5).map((region, k) => (
                            <div 
                              key={`${cityKey}-${region.name}-${k}`} 
                              className="flex items-center justify-between p-2.5 pl-14 text-xs border-b border-border/50 last:border-b-0"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">📍</span>
                                <span className="text-muted-foreground">{region.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{region.total.toLocaleString()}</span>
                                <span className={parseFloat(region.optInRate) > 10 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                  {region.optInRate}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
