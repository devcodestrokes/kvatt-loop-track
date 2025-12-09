import { 
  BarChart3, 
  QrCode, 
  Tag, 
  Store, 
  PackageCheck, 
  PackageX,
  Settings,
  HelpCircle,
  Package,
  Leaf,
  Globe,
  Lightbulb,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import kvattLogo from '@/assets/kvatt-logo.jpeg';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const overviewItems = [
  { title: 'Analytics', url: '/', icon: BarChart3 },
  { title: 'Insights', url: '/insights', icon: Lightbulb },
];

const packagingItems = [
  { title: 'Label Generation', url: '/labels', icon: Tag },
  { title: 'QR Tracking', url: '/qr-tracking', icon: QrCode },
  { title: 'Stock Management', url: '/stock', icon: Package },
];

const logisticsItems = [
  { title: 'Outbound', url: '/outbound', icon: PackageCheck },
  { title: 'Inbound', url: '/inbound', icon: PackageX },
];

const merchantItems = [
  { title: 'Merchants', url: '/merchants', icon: Store },
  { title: 'Landing Pages', url: '/landing-pages', icon: Globe },
];

const sustainabilityItems = [
  { title: 'Circularity Reports', url: '/circularity', icon: Leaf },
];

const settingsItems = [
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'Help', url: '/help', icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { user, signOut } = useAuthContext();

  const handleSignOut = async () => {
    await signOut();
  };

  const renderMenuItems = (items: typeof overviewItems) => (
    <SidebarMenu className="space-y-1">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink 
              to={item.url} 
              end={item.url === '/'}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground transition-all duration-200 hover:bg-primary/5 hover:text-foreground"
              activeClassName="bg-primary/10 text-primary font-semibold shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/60 transition-all duration-200 group-hover:bg-primary/10 group-hover:text-primary group-[.bg-primary\\/10]:bg-primary/15 group-[.bg-primary\\/10]:text-primary">
                <item.icon className="h-4 w-4" />
              </div>
              {!isCollapsed && (
                <span className="flex-1 text-sm">{item.title}</span>
              )}
              {!isCollapsed && (
                <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-50" />
              )}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-sidebar/80 backdrop-blur-xl">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={kvattLogo} 
              alt="Kvatt" 
              className="h-11 w-11 rounded-xl object-cover ring-2 ring-primary/20"
            />
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-sidebar" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-bold text-foreground">Kvatt</h2>
              <p className="text-xs font-medium text-muted-foreground">Admin Dashboard</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(overviewItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Packaging
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(packagingItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Logistics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(logisticsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Merchants
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(merchantItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Sustainability
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(sustainabilityItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-4">
        <SidebarGroup>
          <SidebarGroupContent>
            {renderMenuItems(settingsItems)}
            <div className="mt-4 px-1">
              {!isCollapsed && user && (
                <div className="mb-3 rounded-xl bg-secondary/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Signed in as</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                    {user.email}
                  </p>
                </div>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start gap-2 rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                {!isCollapsed && 'Sign Out'}
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
