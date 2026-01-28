import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";
import { FilterLoadingOverlay } from "@/components/dashboard/FilterLoadingOverlay";
import { createContext, useContext, useState, useCallback } from "react";

// Create context for loading state
interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  setLoading: () => {},
});

export const useGlobalLoading = () => useContext(LoadingContext);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading }}>
      <SidebarProvider>
        {/* Global loading bar - renders at absolute top of screen */}
        <FilterLoadingOverlay isLoading={isLoading} />
        
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
              <div className="animate-fade-in">{children}</div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </LoadingContext.Provider>
  );
}
