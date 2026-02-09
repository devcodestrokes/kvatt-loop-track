import { useState } from "react";
import { Search, Mail, Package, Calendar, DollarSign, MapPin, Loader2, Store, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// Store mapping from CSV data
const STORE_MAPPINGS: Record<string, string> = {
  '1': 'kvatt-green-package-demo',
  '5': 'Quickstart',
  '6': 'TOAST DEV',
  '7': 'Universal Works',
  '8': 'TOAST NEW DEV',
  '9': 'TOAST NEW DEV USD',
  '10': 'TOAST DEV USD',
  '11': 'KVATT DEV',
  '12': 'TOAST',
  '13': 'Zapply EU',
  '14': 'Cocopup™ Wipes',
  '15': 'Anerkennen Fashion',
  '16': 'SPARTAGIFTSHOP USA',
  '17': 'SIRPLUS',
  '20': 'Kvatt - Demo Store',
  '23': 'smit-v2',
  '24': 'partht-kvatt-demo',
  '25': 'vrutankt.devesha',
  '26': 'Plus Test Store 1',
  '27': 'Kvatt | One Tap Returns',
  '28': 'leming-kvatt-demo',
  '29': 'Kapil Kvatt Checkout',
  '30': 'SCALES SwimSkins',
};

const getStoreName = (userId: string | null): string => {
  if (!userId) return "N/A";
  return STORE_MAPPINGS[userId] || `Store ${userId}`;
};

const extractOrderNumber = (orderName: string): string => {
  // Strip any prefix like "#" or store-specific prefixes (e.g., "#277766", "SP163967", "UKT2344084")
  return orderName.replace(/^#/, '');
};

const getReturnPortalUrl = (order: OrderResult, customerEmail: string): string | null => {
  const storeName = getStoreName(order.user_id);
  const orderId = extractOrderNumber(order.name || '');
  
  switch (storeName) {
    case 'SIRPLUS':
      return `https://returnsportal.shop/sirplus?s=1&lang=&e=${encodeURIComponent(customerEmail)}&o=${encodeURIComponent(orderId)}&a=true`;
    case 'Universal Works':
      return `https://returns.universalworks.co.uk/?s=1&lang=&e=${encodeURIComponent(customerEmail)}&o=${encodeURIComponent(orderId)}`;
    case 'TOAST':
      return `https://toast.returns.international/`;
    default:
      return null;
  }
};

interface OrderResult {
  id: string;
  name: string;
  total_price: number;
  opt_in: boolean;
  payment_status: string;
  shopify_created_at: string;
  shopify_order_id: string | null;
  city: string;
  province: string;
  country: string;
  user_id: string;
}

interface CustomerInfo {
  external_id: string;
  name: string;
  email: string;
  telephone: string;
}

export default function SearchOrders() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setOrders([]);
    setCustomer(null);
    setSearched(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('search-orders-by-email', {
        body: { email: email.trim() },
      });

      if (fnError) {
        setError("Failed to search orders");
        setLoading(false);
        return;
      }

      if (!data?.success || !data?.customer) {
        setError(data?.message || "No customer found with this email");
        setLoading(false);
        return;
      }

      setCustomer({
        external_id: data.customer.id,
        name: data.customer.name,
        email: data.customer.email,
        telephone: data.customer.telephone,
      });

      setOrders(data.orders || []);
    } catch (err) {
      setError("An error occurred while searching");
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = orders.reduce((sum, order) => sum + (order.total_price || 0), 0);

  return (
    <div className="space-y-6 p-6">

      {/* Search Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter customer email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customer Info */}
      {customer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{customer.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{customer.telephone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="font-medium">{orders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Orders</span>
              </div>
              <p className="mt-1 text-2xl font-bold">{orders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Spent</span>
              </div>
              <p className="mt-1 text-2xl font-bold">£{totalSpent.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Opt-ins</span>
              </div>
              <p className="mt-1 text-2xl font-bold">
                {orders.filter((o) => o.opt_in).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Order</span>
              </div>
              <p className="mt-1 text-2xl font-bold">
                £{orders.length > 0 ? (totalSpent / orders.length).toFixed(2) : "0.00"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Orders List */}
      {searched && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-8 text-center text-muted-foreground">{error}</div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No orders found for this customer
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const returnUrl = customer ? getReturnPortalUrl(order, customer.email) : null;
                  return (
                    <div
                      key={order.id}
                      className={`flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50 ${returnUrl ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (returnUrl) {
                          window.open(returnUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.name}</span>
                          {order.shopify_order_id && (
                            <span className="text-xs text-muted-foreground">
                              (Shopify: {order.shopify_order_id})
                            </span>
                          )}
                          <Badge
                            variant={order.opt_in ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {order.opt_in ? "Opted In" : "Opted Out"}
                          </Badge>
                          {order.payment_status && (
                            <Badge variant="outline" className="text-xs">
                              {order.payment_status}
                            </Badge>
                          )}
                          {returnUrl && (
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {order.shopify_created_at
                              ? format(new Date(order.shopify_created_at), "MMM d, yyyy")
                              : "N/A"}
                          </span>
                          {(order.city || order.country) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[order.city, order.province, order.country]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            {getStoreName(order.user_id)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          £{(order.total_price || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
