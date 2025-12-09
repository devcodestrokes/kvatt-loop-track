import { Settings as SettingsIcon, Bell, Shield, Palette } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

const Settings = () => {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your dashboard preferences and integrations
        </p>
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
