import { useState, useEffect } from 'react';
import { Bell, Shield, Palette, UserPlus, Loader2, Mail, Trash2, Check, Clock, Users, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserDefaults, DATE_RANGE_PRESET_LABELS, DateRangePreset } from '@/hooks/useUserDefaults';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const emailSchema = z.string().email({ message: "Please enter a valid email address" });

interface AdminInvite {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

interface AdminUser {
  id: string;
  user_id: string;
  role: 'admin' | 'super_admin';
  created_at: string;
  email: string | null;
  full_name: string | null;
}

const Settings = () => {
  const { isSuperAdmin, user } = useAuthContext();
  const { defaults, updateDefaults } = useUserDefaults();
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setIsLoadingData(true);
    try {
      // Fetch invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('admin_invites')
        .select('id, email, created_at, expires_at, accepted_at')
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setInvites(invitesData || []);

      // Fetch admin users
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Get profile info for each admin
      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        const adminsWithProfiles = rolesData.map(role => {
          const profile = profilesData?.find(p => p.id === role.user_id);
          return {
            ...role,
            email: profile?.email || null,
            full_name: profile?.full_name || null,
          };
        });
        setAdmins(adminsWithProfiles);
      } else {
        setAdmins([]);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdminData();
    }
  }, [isSuperAdmin]);

  const handleInviteAdmin = async () => {
    const result = emailSchema.safeParse(inviteEmail.trim());
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsInviting(true);
    try {
      const trimmedEmail = inviteEmail.trim();
      
      // Check if user is already an admin by checking profiles + user_roles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (existingProfile) {
        // Check if they have an admin role
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', existingProfile.id)
          .maybeSingle();

        if (existingRole) {
          toast.error('This email is already an admin');
          setIsInviting(false);
          return;
        }
      }

      // Check if there's already a pending (non-accepted) invite
      const { data: existingInvite } = await supabase
        .from('admin_invites')
        .select('id, accepted_at')
        .eq('email', trimmedEmail)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingInvite) {
        toast.error('This email has already been invited');
        setIsInviting(false);
        return;
      }

      // Delete any old/accepted invites for this email to allow re-invite
      await supabase
        .from('admin_invites')
        .delete()
        .eq('email', trimmedEmail);

      // Create invite
      const { error } = await supabase
        .from('admin_invites')
        .insert({
          email: trimmedEmail,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (error) throw error;

      // Send email notification
      try {
        const { error: emailError } = await supabase.functions.invoke('send-admin-invite', {
          body: { email: trimmedEmail }
        });

        if (emailError) {
          console.error('Email send error:', emailError);
          toast.success(`Invite created for ${trimmedEmail} (email delivery may be delayed)`);
        } else {
          toast.success(`Invite sent to ${trimmedEmail}`);
        }
      } catch (emailErr) {
        console.error('Email function error:', emailErr);
        toast.success(`Invite created for ${trimmedEmail}`);
      }

      setInviteEmail('');
      fetchAdminData();
    } catch (error: any) {
      console.error('Error inviting admin:', error);
      toast.error('Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    setDeletingId(inviteId);
    try {
      const { error } = await supabase
        .from('admin_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
      toast.success('Invite deleted');
      fetchAdminData();
    } catch (error) {
      console.error('Error deleting invite:', error);
      toast.error('Failed to delete invite');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRemoveAdmin = async (roleId: string, userId: string) => {
    if (userId === user?.id) {
      toast.error("You cannot remove yourself");
      return;
    }

    setDeletingId(roleId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      toast.success('Admin removed');
      fetchAdminData();
    } catch (error) {
      console.error('Error removing admin:', error);
      toast.error('Failed to remove admin');
    } finally {
      setDeletingId(null);
    }
  };

  const pendingInvites = invites.filter(i => !i.accepted_at && new Date(i.expires_at) > new Date());
  const acceptedInvites = invites.filter(i => i.accepted_at);
  const expiredInvites = invites.filter(i => !i.accepted_at && new Date(i.expires_at) <= new Date());

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your dashboard preferences and integrations
        </p>
      </div>

      {/* Admin Management - Super Admin Only */}
      {isSuperAdmin && (
        <>
          {/* Invite New Admin */}
          <div className="metric-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Invite Admin</h3>
                <p className="text-sm text-muted-foreground">Send invitations to new admin users</p>
              </div>
            </div>
            <Separator />
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
          </div>

          {/* Current Admins */}
          <div className="metric-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Current Admins</h3>
                <p className="text-sm text-muted-foreground">{admins.length} admin{admins.length !== 1 ? 's' : ''} with access</p>
              </div>
            </div>
            <Separator />
            {isLoadingData ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : admins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No admins found</p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {admin.full_name?.[0] || admin.email?.[0] || 'A'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{admin.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </Badge>
                      {admin.user_id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Admin</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {admin.email} as an admin? They will lose access to the dashboard.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleRemoveAdmin(admin.id, admin.user_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deletingId === admin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invites */}
          <div className="metric-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Pending Invites</h3>
                <p className="text-sm text-muted-foreground">{pendingInvites.length} pending, {acceptedInvites.length} accepted</p>
              </div>
            </div>
            <Separator />
            {isLoadingData ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : pendingInvites.length === 0 && acceptedInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No invites yet</p>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                    <div>
                      <p className="font-medium text-sm">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Invite</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the invite for {invite.email}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteInvite(invite.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deletingId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {acceptedInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
                    <div>
                      <p className="font-medium text-sm">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Accepted {new Date(invite.accepted_at!).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                      <Check className="h-3 w-3 mr-1" />
                      Accepted
                    </Badge>
                  </div>
                ))}
                {expiredInvites.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-2">
                    + {expiredInvites.length} expired invite{expiredInvites.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dashboard Defaults */}
      <div className="metric-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Dashboard Defaults</h3>
            <p className="text-sm text-muted-foreground">Configure default views applied on login</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="dateRange">Default Date Range</Label>
            <Select
              value={defaults.dateRangePreset}
              onValueChange={(value: DateRangePreset) => updateDefaults({ dateRangePreset: value })}
            >
              <SelectTrigger id="dateRange">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATE_RANGE_PRESET_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Week starts on Monday</Label>
              <p className="text-sm text-muted-foreground">Used for "Since last Monday" calculations</p>
            </div>
            <Switch 
              checked={defaults.weekStartsOnMonday}
              onCheckedChange={(checked) => updateDefaults({ weekStartsOnMonday: checked })}
            />
          </div>
        </div>
      </div>

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
