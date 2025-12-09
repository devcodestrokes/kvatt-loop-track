import { useState } from 'react';
import { Bell, Shield, Palette, UserPlus, Loader2, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().email({ message: "Please enter a valid email address" });

const Settings = () => {
  const { isSuperAdmin } = useAuthContext();
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const handleInviteAdmin = async () => {
    // Validate email
    const result = emailSchema.safeParse(inviteEmail.trim());
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsInviting(true);
    try {
      // Check if already invited
      const { data: existing } = await supabase
        .from('admin_invites')
        .select('id, accepted_at')
        .eq('email', inviteEmail.trim())
        .maybeSingle();

      if (existing) {
        if (existing.accepted_at) {
          toast.error('This email has already been registered as an admin');
        } else {
          toast.error('This email has already been invited');
        }
        setIsInviting(false);
        return;
      }

      // Create invite
      const { error } = await supabase
        .from('admin_invites')
        .insert({
          email: inviteEmail.trim(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        });

      if (error) throw error;

      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (error: any) {
      console.error('Error inviting admin:', error);
      toast.error('Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your dashboard preferences and integrations
        </p>
      </div>

      {/* Admin Management - Super Admin Only */}
      {isSuperAdmin && (
        <div className="metric-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Admin Management</h3>
              <p className="text-sm text-muted-foreground">Invite new admin users to the dashboard</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInviteAdmin()}
                />
              </div>
              <Button onClick={handleInviteAdmin} disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Invite
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Invited users will be able to sign up and access the admin dashboard. Invites expire after 30 days.
            </p>
          </div>
        </div>
      )}

      {/* API Configuration */}
      <div className="metric-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">API Configuration</h3>
            <p className="text-sm text-muted-foreground">Manage API endpoints and authentication</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="apiUrl">Analytics API URL</Label>
            <Input id="apiUrl" value="https://shopify.kvatt.com/api/get-alaytics" readOnly />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="storesUrl">Stores API URL</Label>
            <Input id="storesUrl" value="https://shopify.kvatt.com/api/get-stores" readOnly />
          </div>
          <Button variant="outline">Update API Keys</Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="metric-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-total/10 text-chart-total">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Notifications</h3>
            <p className="text-sm text-muted-foreground">Configure alert preferences</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Low Return Rate Alerts</Label>
              <p className="text-sm text-muted-foreground">Get notified when return rate drops below 50%</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>New Merchant Signups</Label>
              <p className="text-sm text-muted-foreground">Get notified when a new merchant joins</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Daily Summary</Label>
              <p className="text-sm text-muted-foreground">Receive daily analytics summary via email</p>
            </div>
            <Switch />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="metric-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-kvatt-brown/10 text-kvatt-brown">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Appearance</h3>
            <p className="text-sm text-muted-foreground">Customize the dashboard look</p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label>Compact Mode</Label>
            <p className="text-sm text-muted-foreground">Show more data in less space</p>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  );
};

export default Settings;
