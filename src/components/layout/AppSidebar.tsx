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
  Truck
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import kvattLogo from '@/assets/kvatt-logo.jpeg';
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

  const renderMenuItems = (items: typeof overviewItems) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink 
              to={item.url} 
              end={item.url === '/'}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeClassName="bg-primary/10 text-primary font-medium"
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img 
            src={kvattLogo} 
            alt="Kvatt" 
            className="h-10 w-10 rounded-lg object-cover shadow-sm"
          />
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-semibold text-foreground">Kvatt</h2>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(overviewItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Packaging</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(packagingItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Logistics</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(logisticsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Merchants</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(merchantItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sustainability</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(sustainabilityItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            {renderMenuItems(settingsItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
