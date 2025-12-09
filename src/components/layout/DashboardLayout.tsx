import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
            <SidebarTrigger className="-ml-2 flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/50 text-muted-foreground transition-all hover:bg-card hover:text-foreground hover:shadow-sm">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>
            <div className="h-6 w-px bg-border/50" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-6 sm:p-8 lg:p-10">
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
