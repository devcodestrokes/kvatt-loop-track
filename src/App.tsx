import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Analytics from "./pages/Analytics";
import ABTesting from "./pages/ABTesting";
import Labels from "./pages/Labels";
import QRTracking from "./pages/QRTracking";
import Merchants from "./pages/Merchants";
import Outbound from "./pages/Outbound";
import Inbound from "./pages/Inbound";
import StockManagement from "./pages/StockManagement";
import CircularityReports from "./pages/CircularityReports";
import LandingPages from "./pages/LandingPages";
import Insights from "./pages/Insights";
import Customers from "./pages/Customers";
import SearchOrders from "./pages/SearchOrders";
import PackagingLabels from "./pages/PackagingLabels";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/search-orders" element={<SearchOrders />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Analytics />} />
                      <Route path="/ab-testing" element={<ABTesting />} />
                      <Route path="/labels" element={<Labels />} />
                      <Route path="/qr-tracking" element={<QRTracking />} />
                      <Route path="/merchants" element={<Merchants />} />
                      <Route path="/outbound" element={<Outbound />} />
                      <Route path="/inbound" element={<Inbound />} />
                      <Route path="/stock" element={<StockManagement />} />
                      <Route path="/circularity" element={<CircularityReports />} />
                      <Route path="/landing-pages" element={<LandingPages />} />
                      <Route path="/insights" element={<Insights />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/packaging-labels" element={<PackagingLabels />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
