import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { analyticsData } = await req.json();

    if (!analyticsData) {
      throw new Error('Analytics data is required');
    }

    console.log('Analyzing CRO patterns with AI...');

    const systemPrompt = `You are an expert CRO (Conversion Rate Optimization) analyst specializing in sustainable packaging and e-commerce opt-in behavior. 
    
Your task is to analyze customer data and identify patterns, similarities, and actionable insights about customers who opt-in for reusable packaging.

Focus on:
1. DEMOGRAPHIC PATTERNS: Geographic, location-based trends
2. BEHAVIORAL PATTERNS: Product preferences, order values, timing
3. STORE PERFORMANCE: Which stores have better opt-in rates and why
4. PRODUCT CORRELATION: What products do opt-in customers buy more?
5. TIMING PATTERNS: When do opt-ins happen most?
6. ACTIONABLE RECOMMENDATIONS: Specific strategies to increase opt-in rates

Be specific, data-driven, and provide concrete recommendations. Format your response as structured JSON for easy parsing.`;

    // Handle both old and new data structures
    const summary = analyticsData.summary || {};
    const geographic = analyticsData.geographic || {};
    const stores = analyticsData.stores || [];
    const temporal = analyticsData.temporal || {};
    const orderValueAnalysis = analyticsData.orderValueAnalysis || [];

    const userPrompt = `Analyze this customer analytics data and provide CRO insights:

SUMMARY:
- Total Orders: ${summary.totalOrders || summary.totalCustomers || 0}
- Opt-In Rate: ${summary.optInRate || '0'}%
- Total Opt-Ins: ${summary.totalOptIns || 0}
- Total Opt-Outs: ${summary.totalOptOuts || 0}
- Avg Opt-In Order Value: £${summary.avgOptInOrderValue || '0'}
- Avg Opt-Out Order Value: £${summary.avgOptOutOrderValue || '0'}
- Value Difference: £${summary.valueDifference || '0'}

GEOGRAPHIC DATA:
Top Cities: ${JSON.stringify(geographic.topCities?.slice(0, 10) || geographic.optInByCity || [])}
Top Countries: ${JSON.stringify(geographic.topCountries?.slice(0, 10) || geographic.optInByCountry || [])}
Top Provinces: ${JSON.stringify(geographic.topProvinces?.slice(0, 10) || [])}
Best Cities by Opt-In Rate: ${JSON.stringify(geographic.bestCitiesByOptIn?.slice(0, 10) || [])}

STORE PERFORMANCE:
${JSON.stringify(Array.isArray(stores) ? stores.slice(0, 15) : (stores.optInByStore?.slice(0, 15) || []))}

ORDER VALUE ANALYSIS:
${JSON.stringify(orderValueAnalysis.slice(0, 10))}

TEMPORAL PATTERNS:
Opt-ins by Day of Week: ${JSON.stringify(temporal.byDayOfWeek || temporal.optInsByDayOfWeek || [])}
Opt-ins by Month: ${JSON.stringify(temporal.byMonth || [])}

Provide your analysis in this JSON structure:
{
  "keyFindings": [
    { "title": "string", "description": "string", "impact": "high|medium|low", "dataPoint": "string" }
  ],
  "demographicPatterns": {
    "summary": "string",
    "topLocations": ["string"],
    "recommendation": "string"
  },
  "behavioralPatterns": {
    "orderValueInsight": "string",
    "productPreferences": "string",
    "timingInsights": "string"
  },
  "storeAnalysis": {
    "topPerformers": ["string"],
    "underperformers": ["string"],
    "recommendation": "string"
  },
  "actionableRecommendations": [
    { "priority": 1-5, "action": "string", "expectedImpact": "string", "implementation": "string" }
  ],
  "predictedOptInIncrease": "string"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    // Parse the JSON from AI response
    let parsedAnalysis;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedAnalysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.log('Could not parse as JSON, returning raw analysis');
      parsedAnalysis = { rawAnalysis: content };
    }

    console.log('CRO analysis complete');

    return new Response(
      JSON.stringify({ 
        status: 200, 
        data: {
          analysis: parsedAnalysis,
          generatedAt: new Date().toISOString(),
          inputSummary: analyticsData.summary
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in CRO analysis:', error);
    return new Response(
      JSON.stringify({ status: 500, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
