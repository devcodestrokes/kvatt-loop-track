import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid countries list (comprehensive)
const VALID_COUNTRIES = new Set([
  'United Kingdom', 'United States', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 
  'Italy', 'Netherlands', 'Belgium', 'Ireland', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Austria', 'Switzerland', 'Portugal', 'Greece', 'Poland', 'Czech Republic', 'Hungary',
  'Romania', 'Bulgaria', 'Croatia', 'Slovakia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania',
  'Luxembourg', 'Malta', 'Cyprus', 'Iceland', 'New Zealand', 'Japan', 'South Korea', 'China',
  'India', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia', 'Peru', 'South Africa',
  'Egypt', 'Morocco', 'Kenya', 'Nigeria', 'UAE', 'United Arab Emirates', 'Saudi Arabia',
  'Israel', 'Turkey', 'Russia', 'Ukraine', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam',
  'Philippines', 'Indonesia', 'Taiwan', 'Hong Kong', 'Macau', 'Isle Of Man', 'Isle of Man',
  'Jersey', 'Guernsey', 'Gibraltar', 'Monaco', 'Andorra', 'San Marino', 'Vatican City',
  'Liechtenstein', 'Scotland', 'Wales', 'England', 'Northern Ireland', 'Republic of Ireland',
  'USA', 'UK', 'GB', 'Great Britain'
]);

// Valid UK regions/provinces
const VALID_UK_REGIONS = new Set([
  'England', 'Scotland', 'Wales', 'Northern Ireland',
  'Greater London', 'South East', 'South West', 'East of England', 'East Midlands',
  'West Midlands', 'Yorkshire and the Humber', 'North West', 'North East',
  'Aberdeenshire', 'Angus', 'Argyll and Bute', 'Clackmannanshire', 'Dumfries and Galloway',
  'Dundee City', 'East Ayrshire', 'East Dunbartonshire', 'East Lothian', 'East Renfrewshire',
  'Edinburgh', 'Falkirk', 'Fife', 'Glasgow', 'Highland', 'Inverclyde', 'Midlothian',
  'Moray', 'North Ayrshire', 'North Lanarkshire', 'Orkney Islands', 'Perth and Kinross',
  'Renfrewshire', 'Scottish Borders', 'Shetland Islands', 'South Ayrshire', 'South Lanarkshire',
  'Stirling', 'West Dunbartonshire', 'West Lothian', 'Western Isles',
  'Bedfordshire', 'Berkshire', 'Bristol', 'Buckinghamshire', 'Cambridgeshire', 'Cheshire',
  'Cornwall', 'Cumbria', 'Derbyshire', 'Devon', 'Dorset', 'Durham', 'Essex', 'Gloucestershire',
  'Hampshire', 'Herefordshire', 'Hertfordshire', 'Isle of Wight', 'Kent', 'Lancashire',
  'Leicestershire', 'Lincolnshire', 'London', 'Manchester', 'Merseyside', 'Norfolk',
  'Northamptonshire', 'Northumberland', 'Nottinghamshire', 'Oxfordshire', 'Rutland',
  'Shropshire', 'Somerset', 'Staffordshire', 'Suffolk', 'Surrey', 'Sussex', 'East Sussex',
  'West Sussex', 'Tyne and Wear', 'Warwickshire', 'West Midlands', 'Wiltshire', 'Worcestershire',
  'Yorkshire', 'North Yorkshire', 'South Yorkshire', 'West Yorkshire', 'East Yorkshire',
  'Antrim', 'Armagh', 'Down', 'Fermanagh', 'Londonderry', 'Tyrone',
  'Anglesey', 'Blaenau Gwent', 'Bridgend', 'Caerphilly', 'Cardiff', 'Carmarthenshire',
  'Ceredigion', 'Conwy', 'Denbighshire', 'Flintshire', 'Gwynedd', 'Merthyr Tydfil',
  'Monmouthshire', 'Neath Port Talbot', 'Newport', 'Pembrokeshire', 'Powys',
  'Rhondda Cynon Taf', 'Swansea', 'Torfaen', 'Vale of Glamorgan', 'Wrexham',
  // US States
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia'
]);

// Patterns that indicate an address, not a geographic name
const ADDRESS_PATTERNS = [
  /^\d+/,                      // Starts with number
  /\bflat\b/i,                 // Contains "flat"
  /\bfloor\b/i,                // Contains "floor"
  /\bstreet\b/i,               // Contains "street"
  /\broad\b/i,                 // Contains "road"
  /\blane\b/i,                 // Contains "lane"
  /\bclose\b/i,                // Contains "close"
  /\bdrive\b/i,                // Contains "drive"
  /\bavenue\b/i,               // Contains "avenue"
  /\bway\b/i,                  // Contains "way"
  /\bcourt\b/i,                // Contains "court"
  /\bplace\b/i,                // Contains "place"
  /\bterrace\b/i,              // Contains "terrace"
  /\bgardens\b/i,              // Contains "gardens"
  /\bcrescent\b/i,             // Contains "crescent"
  /\bsquare\b/i,               // Contains "square" (except Leicester Square etc)
  /\bgrove\b/i,                // Contains "grove"
  /\bhigh\s+street\b/i,        // High Street
  /\bunit\b/i,                 // Contains "unit"
  /\bapartment\b/i,            // Contains "apartment"
  /\bbuilding\b/i,             // Contains "building"
  /\bhouse\b/i,                // Contains "house"
  /\bestate\b/i,               // Contains "estate"
  /\bpark\b/i,                 // Contains "park" (often address)
  /\bst\.\s/i,                 // St. (street abbreviation)
  /\brd\b/i,                   // rd (road abbreviation)
  /\bln\b/i,                   // ln (lane abbreviation)
  /\bdr\b/i,                   // dr (drive abbreviation)
];

// Check if a value is a valid country
const isValidCountry = (value: string): boolean => {
  if (!value || value === 'Unknown') return false;
  return VALID_COUNTRIES.has(value) || VALID_COUNTRIES.has(value.trim());
};

// Check if a value is a valid region
const isValidRegion = (value: string): boolean => {
  if (!value || value === 'Unknown') return false;
  return VALID_UK_REGIONS.has(value) || VALID_UK_REGIONS.has(value.trim());
};

// Check if a value looks like an address rather than a city name
const looksLikeAddress = (value: string): boolean => {
  if (!value) return true;
  return ADDRESS_PATTERNS.some(pattern => pattern.test(value));
};

// Check if a value looks like JSON or contains JSON artifacts
const looksLikeJson = (value: string): boolean => {
  if (!value) return false;
  return value.includes('{') || 
         value.includes('"') || 
         value.includes('\\') || 
         value.includes('address') ||
         value.includes('phone') ||
         value.includes('first_name') ||
         value.includes('last_name');
};

// Extract clean geographic values from potentially malformed data
// This handles cases where JSON or partial JSON was stored in city/province/country fields
const extractCleanValue = (value: string | null, fieldName: 'city' | 'province' | 'country'): string | null => {
  if (!value) return null;
  
  // If it's already clean (no JSON markers), return as-is
  if (!looksLikeJson(value)) {
    return value.trim();
  }
  
  // Try multiple extraction strategies
  
  // Strategy 1: Full JSON parse after unescaping
  try {
    let jsonStr = value;
    
    // Remove outer quotes if wrapped
    if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
      jsonStr = jsonStr.slice(1, -1);
    }
    
    // Unescape quotes multiple times (handles double-escaped JSON)
    let prevStr = '';
    while (prevStr !== jsonStr && jsonStr.includes('\\')) {
      prevStr = jsonStr;
      jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && parsed[fieldName]) {
      return parsed[fieldName];
    }
  } catch (e) {
    // Continue to next strategy
  }
  
  // Strategy 2: Regex extraction with escaped quotes
  // Match patterns like: \"city\":\"Manchester\" or "city":"Manchester"
  const escapedPattern = new RegExp(`\\\\"${fieldName}\\\\"\\s*:\\s*\\\\"([^\\\\]+)\\\\"`, 'i');
  const escapedMatch = value.match(escapedPattern);
  if (escapedMatch && escapedMatch[1]) {
    return escapedMatch[1];
  }
  
  // Strategy 3: Standard JSON regex
  const standardPattern = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]+)"`, 'i');
  const standardMatch = value.match(standardPattern);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1];
  }
  
  // Strategy 4: Unescaped then regex
  try {
    const unescaped = value.replace(/\\"/g, '"');
    const unescapedMatch = unescaped.match(new RegExp(`"${fieldName}"\\s*:\\s*"([^"]+)"`, 'i'));
    if (unescapedMatch && unescapedMatch[1]) {
      return unescapedMatch[1];
    }
  } catch (e) {
    // Continue
  }
  
  // If all strategies fail and value still contains JSON artifacts, return null
  if (looksLikeJson(value)) {
    return null;
  }
  
  return value.trim() || null;
};

// Parse all geographic fields from order data
const parseGeographicData = (order: any): { city: string | null; province: string | null; country: string | null } => {
  // Try to extract from each field
  let city = extractCleanValue(order.city, 'city');
  let province = extractCleanValue(order.province, 'province');
  let country = extractCleanValue(order.country, 'country');
  
  // If city field contained full JSON, it might have province/country too
  if (!province && order.city) {
    province = extractCleanValue(order.city, 'province');
  }
  if (!country && order.city) {
    country = extractCleanValue(order.city, 'country');
  }
  
  // Same for province field
  if (!city && order.province) {
    city = extractCleanValue(order.province, 'city');
  }
  if (!country && order.province) {
    country = extractCleanValue(order.province, 'country');
  }
  
  // And country field
  if (!city && order.country) {
    city = extractCleanValue(order.country, 'city');
  }
  if (!province && order.country) {
    province = extractCleanValue(order.country, 'province');
  }
  
  return { city, province, country };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting imported orders analysis...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all imported orders - using pagination to get all records
    let allOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('imported_orders')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('shopify_created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allOrders = [...allOrders, ...data];
        page++;
        hasMore = data.length === pageSize;
        console.log(`Fetched page ${page}, total orders: ${allOrders.length}`);
      } else {
        hasMore = false;
      }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Calculate totals
    let totalOrders = allOrders.length;
    let totalOptIns = 0;
    let totalOptOuts = 0;
    let optInRevenue = 0;
    let optOutRevenue = 0;

    // Store aggregation
    const storeMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    
    // City aggregation
    const cityMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    
    // Country aggregation
    const countryMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    
    // Province aggregation
    const provinceMap = new Map<string, { total: number; optIn: number; revenue: number }>();

    // Day of week aggregation
    const dayOfWeekMap = new Map<number, { total: number; optIn: number }>();
    
    // Month aggregation
    const monthMap = new Map<string, { total: number; optIn: number }>();

    // Order value ranges
    const valueRanges = [
      { min: 0, max: 25, label: '$0-25' },
      { min: 25, max: 50, label: '$25-50' },
      { min: 50, max: 100, label: '$50-100' },
      { min: 100, max: 200, label: '$100-200' },
      { min: 200, max: 500, label: '$200-500' },
      { min: 500, max: Infinity, label: '$500+' },
    ];
    const valueRangeMap = new Map<string, { total: number; optIn: number }>();
    valueRanges.forEach(r => valueRangeMap.set(r.label, { total: 0, optIn: 0 }));

    allOrders.forEach(order => {
      const isOptIn = order.opt_in === true;
      const price = parseFloat(order.total_price) || 0;
      
      if (isOptIn) {
        totalOptIns++;
        optInRevenue += price;
      } else {
        totalOptOuts++;
        optOutRevenue += price;
      }

      // Store aggregation
      const storeId = order.store_id || 'unknown';
      const storeData = storeMap.get(storeId) || { total: 0, optIn: 0, revenue: 0 };
      storeData.total++;
      if (isOptIn) storeData.optIn++;
      storeData.revenue += price;
      storeMap.set(storeId, storeData);

      // Parse geographic data - handles both proper fields and legacy JSON-in-city data
      const geo = parseGeographicData(order);
      
      const city = geo.city || 'Unknown';
      const province = geo.province || 'Unknown';
      const country = geo.country || 'Unknown';

      // City aggregation - only include if it doesn't look like an address
      if (city !== 'Unknown' && !looksLikeAddress(city) && !looksLikeJson(city)) {
        const cityData = cityMap.get(city) || { total: 0, optIn: 0, revenue: 0 };
        cityData.total++;
        if (isOptIn) cityData.optIn++;
        cityData.revenue += price;
        cityMap.set(city, cityData);
      }

      // Country aggregation - only include valid countries
      if (isValidCountry(country)) {
        const countryData = countryMap.get(country) || { total: 0, optIn: 0, revenue: 0 };
        countryData.total++;
        if (isOptIn) countryData.optIn++;
        countryData.revenue += price;
        countryMap.set(country, countryData);
      }

      // Province aggregation - only include valid regions
      if (isValidRegion(province)) {
        const provinceData = provinceMap.get(province) || { total: 0, optIn: 0, revenue: 0 };
        provinceData.total++;
        if (isOptIn) provinceData.optIn++;
        provinceMap.set(province, provinceData);
      }

      // Temporal analysis
      if (order.shopify_created_at) {
        const date = new Date(order.shopify_created_at);
        const dayOfWeek = date.getDay();
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const dayData = dayOfWeekMap.get(dayOfWeek) || { total: 0, optIn: 0 };
        dayData.total++;
        if (isOptIn) dayData.optIn++;
        dayOfWeekMap.set(dayOfWeek, dayData);

        const monthData = monthMap.get(month) || { total: 0, optIn: 0 };
        monthData.total++;
        if (isOptIn) monthData.optIn++;
        monthMap.set(month, monthData);
      }

      // Value range analysis
      for (const range of valueRanges) {
        if (price >= range.min && price < range.max) {
          const rangeData = valueRangeMap.get(range.label)!;
          rangeData.total++;
          if (isOptIn) rangeData.optIn++;
          break;
        }
      }
    });

    const optInRate = totalOrders > 0 ? ((totalOptIns / totalOrders) * 100).toFixed(2) : '0.00';
    const avgOptInOrderValue = totalOptIns > 0 ? (optInRevenue / totalOptIns).toFixed(2) : '0.00';
    const avgOptOutOrderValue = totalOptOuts > 0 ? (optOutRevenue / totalOptOuts).toFixed(2) : '0.00';
    const valueDifference = (parseFloat(avgOptInOrderValue) - parseFloat(avgOptOutOrderValue)).toFixed(2);

    // Format store data
    const stores = Array.from(storeMap.entries())
      .map(([storeId, data]) => ({
        storeId,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
        avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
        totalRevenue: data.revenue.toFixed(2),
      }))
      .sort((a, b) => b.total - a.total);

    // Format city data
    const topCities = Array.from(cityMap.entries())
      .filter(([name]) => name !== 'Unknown')
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
        avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const bestCitiesByOptIn = [...topCities]
      .filter(c => c.total >= 10)
      .sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))
      .slice(0, 10);

    // Format country data
    const topCountries = Array.from(countryMap.entries())
      .filter(([name]) => name !== 'Unknown')
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
        avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Format province data
    const topProvinces = Array.from(provinceMap.entries())
      .filter(([name]) => name !== 'Unknown')
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Format day of week data
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek = Array.from(dayOfWeekMap.entries())
      .map(([dayNum, data]) => ({
        day: dayNames[dayNum],
        dayNum,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => a.dayNum - b.dayNum);

    // Format month data
    const byMonth = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Format order value analysis
    const orderValueAnalysis = valueRanges.map(range => {
      const data = valueRangeMap.get(range.label)!;
      return {
        range: range.label,
        total: data.total,
        optIns: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      };
    });

    // Generate insights
    const insights = [];

    // Best performing store
    const bestStore = [...stores].sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
    if (bestStore && parseFloat(bestStore.optInRate) > 0) {
      insights.push({
        type: 'store',
        title: 'Top Performing Store',
        description: `${bestStore.storeId.replace('.myshopify.com', '')} leads with ${bestStore.optInRate}% opt-in rate`,
        value: bestStore.optInRate,
        impact: 'high' as const,
      });
    }

    // Value difference insight
    if (parseFloat(valueDifference) > 0) {
      insights.push({
        type: 'value',
        title: 'Opt-In Customers Spend More',
        description: `Opt-in customers spend $${valueDifference} more on average`,
        value: valueDifference,
        impact: 'high' as const,
      });
    }

    // Best city insight
    if (bestCitiesByOptIn.length > 0) {
      const bestCity = bestCitiesByOptIn[0];
      insights.push({
        type: 'geographic',
        title: 'Best Performing City',
        description: `${bestCity.name} has ${bestCity.optInRate}% opt-in rate with ${bestCity.total} orders`,
        value: bestCity.optInRate,
        impact: 'medium' as const,
      });
    }

    const analytics = {
      summary: {
        totalOrders,
        totalOptIns,
        totalOptOuts,
        optInRate,
        avgOptInOrderValue,
        avgOptOutOrderValue,
        valueDifference,
      },
      orderValueAnalysis,
      geographic: {
        topCities,
        bestCitiesByOptIn,
        topCountries,
        topProvinces,
      },
      stores,
      temporal: {
        byDayOfWeek,
        byMonth,
      },
      insights,
    };

    console.log('Analysis complete');

    return new Response(
      JSON.stringify({ success: true, data: analytics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
