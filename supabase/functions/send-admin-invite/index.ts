import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminInviteRequest {
  email: string;
  invitedByName?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, invitedByName }: AdminInviteRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log(`Sending admin invite to: ${email}`);

    // Get the app URL for the invite link - use deployed URL
    const appUrl = Deno.env.get("APP_URL") || "https://5dc6de10-4e17-4275-aeff-1624618334bd.lovable.app";
    const inviteLink = `${appUrl}/auth`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #faf9f7; margin: 0; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
          <div style="background-color: #fe655b; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Kvatt</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">Sustainable Packaging Platform</p>
          </div>
          
          <div style="padding: 40px 32px;">
            <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">You're Invited!</h2>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${invitedByName ? `<strong>${invitedByName}</strong> has invited you` : "You've been invited"} to join the Kvatt Admin Dashboard as an administrator.
            </p>
            
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
              As an admin, you'll have access to:
            </p>
            
            <ul style="color: #4a4a4a; font-size: 15px; line-height: 1.8; margin: 0 0 32px 0; padding-left: 20px;">
              <li>Analytics and opt-in tracking</li>
              <li>Merchant management</li>
              <li>Label and QR code tracking</li>
              <li>Circularity reports</li>
              <li>Stock management</li>
            </ul>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteLink}" style="display: inline-block; background-color: #fe655b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #737373; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
              This invitation will expire in 30 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          
          <div style="background-color: #f5f4f2; padding: 24px 32px; text-align: center;">
            <p style="color: #737373; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} Kvatt. Sustainable packaging for a better future.
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
        from: "Kvatt Admin <noreply@codestrokes.com>",
        to: [email],
        subject: "You've been invited to Kvatt Admin Dashboard",
        html: emailHtml,
      }),
    });

    const emailResponse = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", emailResponse);
      
      // Check for domain verification error
      if (emailResponse.message?.includes("verify a domain")) {
        throw new Error("Email domain not verified. In test mode, emails can only be sent to the Resend account owner's email. Please verify your domain at resend.com/domains for production use.");
      }
      
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("Admin invite email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Invitation sent to ${email}`,
        data: emailResponse 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending admin invite:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
