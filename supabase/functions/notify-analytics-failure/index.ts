import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  dateRange?: {
    from: string;
    to: string;
  };
  storeId?: string;
  errorMessage?: string;
}

serve(async (req: Request): Promise<Response> => {
  console.log("notify-analytics-failure function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dateRange, storeId, errorMessage }: NotifyRequest = await req.json();

    console.log("Sending notification email for analytics failure:", {
      dateRange,
      storeId,
      errorMessage,
    });

    const dateInfo = dateRange 
      ? `${dateRange.from} to ${dateRange.to}` 
      : "No date range specified";
    
    const storeInfo = storeId || "All stores";
    const errorInfo = errorMessage || "No data returned from API";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #faf9f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
          <div style="background-color: #e74c3c; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">⚠️ Analytics Alert</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">Kvatt Dashboard Notification</p>
          </div>
          
          <div style="padding: 40px 32px;">
            <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">Analytics Data Fetch Failed</h2>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              The Kvatt dashboard was unable to retrieve analytics data from the Shopify API.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Date Range:</td>
                  <td style="padding: 8px 0; color: #333;">${dateInfo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Store:</td>
                  <td style="padding: 8px 0; color: #333;">${storeInfo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Issue:</td>
                  <td style="padding: 8px 0; color: #e74c3c;">${errorInfo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Timestamp:</td>
                  <td style="padding: 8px 0; color: #333;">${new Date().toISOString()}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #737373; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
              Please check the Shopify API connection and ensure data is available for the requested parameters.
            </p>
          </div>
          
          <div style="background-color: #f5f4f2; padding: 24px 32px; text-align: center;">
            <p style="color: #737373; font-size: 13px; margin: 0;">
              This is an automated notification from the Kvatt Analytics Dashboard.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend API directly
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Kvatt Analytics <noreply@codestrokes.com>",
        to: ["dev.codestrokes@gmail.com"],
        subject: "⚠️ Analytics Data Fetch Failed - Kvatt Dashboard",
        html: emailHtml,
      }),
    });

    const emailResponse = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", emailResponse);
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("Notification email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending notification email:", error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
