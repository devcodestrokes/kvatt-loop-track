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
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { user, signOut } = useAuthContext();

  const handleSignOut = async () => {
    await signOut();
  };

  const renderMenuItems = (items: typeof overviewItems) => (
    <SidebarMenu className="space-y-0">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink 
              to={item.url} 
              end={item.url === '/'}
              className="group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-muted-foreground/80 transition-all duration-200 hover:bg-kvatt-terracotta/8 hover:text-foreground"
              activeClassName="bg-kvatt-terracotta/12 text-kvatt-terracotta font-semibold"
            >
              <item.icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-kvatt-terracotta group-[.bg-kvatt-terracotta\\/12]:text-kvatt-terracotta" />
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.title}</span>
              )}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-background">
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <img 
            src={kvattLogo} 
            alt="Kvatt" 
            className="h-8 w-8 rounded-lg object-cover"
          />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-foreground">Kvatt</span>
              <span className="text-[10px] font-medium text-muted-foreground">Admin Portal</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-1">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(overviewItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3">
          <SidebarGroupLabel className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Packaging
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(packagingItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3">
          <SidebarGroupLabel className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Logistics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(logisticsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3">
          <SidebarGroupLabel className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Merchants
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(merchantItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3">
          <SidebarGroupLabel className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Sustainability
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(sustainabilityItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            {renderMenuItems(settingsItems)}
            <div className="mt-2">
              {!isCollapsed && user && (
                <div className="mb-1.5 rounded-md bg-muted/50 px-2.5 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">Account</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-foreground">
                    {user.email}
                  </p>
                </div>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-full justify-start gap-2 rounded-md px-2.5 text-muted-foreground/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                {!isCollapsed && <span className="text-[12px]">Sign Out</span>}
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
