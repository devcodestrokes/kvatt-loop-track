import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, Users, ChevronLeft, ChevronRight, RefreshCw, Mail, Phone, 
  Store as StoreIcon, ShoppingCart, ChevronDown, ChevronUp, Download, ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MultiStoreSelector } from '@/components/dashboard/MultiStoreSelector';
import { useStoreFilter } from '@/hooks/useStoreFilter';
import { Store as StoreType } from '@/types/analytics';

interface Customer {
  id: string;
  external_id: string;
  user_id: string;
  shopify_customer_id: string | null;
  name: string | null;
  email: string | null;
  telephone: string | null;
  shopify_created_at: string | null;
  created_at: string;
}

interface Order {
  id: string;
  external_id: string;
  name: string | null;
  total_price: number | null;
  opt_in: boolean | null;
  payment_status: string | null;
  shopify_created_at: string | null;
  city: string | null;
  country: string | null;
}

interface CustomerWithOrders extends Customer {
  orders: Order[];
  orderCount: number;
  totalSpent: number;
}

const Customers = () => {
  const [customers, setCustomers] = useState<CustomerWithOrders[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const pageSize = 50;
  
  // Store management
  const [availableStores, setAvailableStores] = useState<StoreType[]>([]);
  const [storeNameMapping, setStoreNameMapping] = useState<Map<string, string>>(new Map());
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  
  const {
    selectedStores,
    toggleStore,
    selectAll,
    unselectAll,
    isInitialized,
  } = useStoreFilter(availableStores);

  // Fetch stores from the store mapping edge function
  const fetchStores = useCallback(async () => {
    setIsLoadingStores(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-store-mapping');
      
      if (error) throw error;
      
      if (data?.success && data?.stores?.length) {
        const mapping = new Map<string, string>();
        data.stores.forEach((store: any) => {
          mapping.set(store.id, store.name);
        });
        setStoreNameMapping(mapping);
        
        const storesList: StoreType[] = data.stores.map((store: any) => ({
          id: store.id,
          name: `${store.name} (${store.orderCount?.toLocaleString() || 0} orders)`
        }));
        setAvailableStores(storesList);
      }
    } catch (err) {
      console.error("Error fetching stores:", err);
    } finally {
      setIsLoadingStores(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync customers from API to Supabase
  const syncCustomers = async () => {
    setIsSyncing(true);
    try {
      // pagesLimit: 0 means fetch ALL pages (70k+ customers)
      const { data, error } = await supabase.functions.invoke('sync-customers-api', {
        body: { forceFull: false, pagesLimit: 0 },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Sync Complete',
          description: `Synced ${data.inserted} customers. Total: ${data.total?.toLocaleString()}`,
        });
        fetchCustomers(currentPage);
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Error syncing customers:', error);
      toast({
        title: 'Sync Error',
        description: error.message || 'Failed to sync customer data',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch customers from Supabase with aggregated order stats (server-side)
  const fetchCustomers = useCallback(async (page: number = 1) => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let customerQuery = supabase
        .from('imported_customers')
        .select('*', { count: 'exact' });

      if (selectedStores.length > 0 && selectedStores.length < availableStores.length) {
        customerQuery = customerQuery.in('user_id', selectedStores);
      }

      if (debouncedSearch) {
        customerQuery = customerQuery.or(`email.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`);
      }

      customerQuery = customerQuery
        .order('shopify_created_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      const { data: customersData, error: customersError, count } = await customerQuery;

      if (customersError) throw customersError;

      setTotalCount(count || 0);

      if (!customersData || customersData.length === 0) {
        setCustomers([]);
        return;
      }

      // Use external_id for matching (orders.customer_id = customers.external_id)
      const customerExternalIds = customersData
        .map(c => c.external_id)
        .filter(Boolean);

      // Fetch aggregated order stats using RPC function (much faster than fetching all orders)
      let statsMap = new Map<string, { orderCount: number; totalSpent: number }>();
      
      if (customerExternalIds.length > 0) {
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_customer_order_stats', { customer_ids: customerExternalIds });

        if (!statsError && statsData) {
          statsData.forEach((stat: any) => {
            statsMap.set(stat.customer_id, {
              orderCount: Number(stat.order_count) || 0,
              totalSpent: Number(stat.total_spent) || 0,
            });
          });
        }
      }

      const customersWithOrders: CustomerWithOrders[] = customersData.map(customer => {
        const stats = statsMap.get(customer.external_id || '') || { orderCount: 0, totalSpent: 0 };
        
        return {
          ...customer,
          orders: [], // Orders loaded on-demand when expanded
          orderCount: stats.orderCount,
          totalSpent: stats.totalSpent,
        };
      });

      setCustomers(customersWithOrders);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch customer data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedStores, debouncedSearch, toast, isInitialized, availableStores.length]);

  useEffect(() => {
    if (isInitialized) {
      fetchCustomers(currentPage);
    }
  }, [currentPage, selectedStores, debouncedSearch, fetchCustomers, isInitialized]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const toggleCustomerExpand = async (customerId: string, externalId: string) => {
    const isCurrentlyExpanded = expandedCustomers.has(customerId);
    
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });

    // Load orders on-demand when expanding (if not already loaded)
    if (!isCurrentlyExpanded) {
      const customer = customers.find(c => c.id === customerId);
      if (customer && customer.orders.length === 0 && customer.orderCount > 0) {
        setLoadingOrders(prev => new Set(prev).add(customerId));
        
        try {
          const { data: ordersData, error } = await supabase
            .from('imported_orders')
            .select('id, external_id, name, total_price, opt_in, payment_status, shopify_created_at, city, country, customer_id')
            .eq('customer_id', externalId)
            .order('shopify_created_at', { ascending: false })
            .limit(50); // Limit orders per customer for performance

          if (!error && ordersData) {
            setCustomers(prev => prev.map(c => {
              if (c.id === customerId) {
                return {
                  ...c,
                  orders: ordersData.map(order => ({
                    id: order.id,
                    external_id: order.external_id,
                    name: order.name,
                    total_price: order.total_price,
                    opt_in: order.opt_in,
                    payment_status: order.payment_status,
                    shopify_created_at: order.shopify_created_at,
                    city: order.city,
                    country: order.country,
                  })),
                };
              }
              return c;
            }));
          }
        } catch (error) {
          console.error('Error loading orders:', error);
        } finally {
          setLoadingOrders(prev => {
            const newSet = new Set(prev);
            newSet.delete(customerId);
            return newSet;
          });
        }
      }
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const getStoreName = (userId: string) => {
    const name = storeNameMapping.get(userId);
    return name || `Store ${userId}`;
  };

  const getReturnPortalUrl = (storeName: string, email: string, orderName: string) => {
    const lowerStore = storeName.toLowerCase();
    if (lowerStore.includes('sirplus')) {
      return `https://returnsportal.shop/sirplus?s=1&lang=&e=${encodeURIComponent(email)}&o=${encodeURIComponent(orderName)}&a=true`;
    }
    if (lowerStore.includes('universal works') || lowerStore.includes('kvatt - demo store')) {
      return `https://returns.universalworks.co.uk/?s=1&lang=&e=${encodeURIComponent(email)}&o=${encodeURIComponent(orderName)}`;
    }
    if (lowerStore.includes('toast')) {
      return `https://toast.returns.international/`;
    }
    return null;
  };

  const handleOrderClick = (customer: CustomerWithOrders, order: Order) => {
    const storeName = getStoreName(customer.user_id);
    const email = customer.email || '';
    const orderName = (order.name || order.external_id).replace(/^#/, '');
    const url = getReturnPortalUrl(storeName, email, orderName);
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-kvatt-terracotta" />
            Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View customers with their order history
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <MultiStoreSelector
            stores={availableStores}
            selectedStores={selectedStores}
            onToggleStore={toggleStore}
            onSelectAll={selectAll}
            onUnselectAll={unselectAll}
            disabled={isLoadingStores}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={syncCustomers}
            disabled={isSyncing}
            className="gap-2"
          >
            <Download className={`h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Customers'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCustomers(currentPage)}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold text-foreground">
                {totalCount.toLocaleString()}
              </p>
            </div>
            <Users className="h-8 w-8 text-kvatt-terracotta/20" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Showing</p>
              <p className="text-2xl font-bold text-foreground">
                {customers.length}
              </p>
            </div>
            <ShoppingCart className="h-8 w-8 text-kvatt-terracotta/20" />
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Customer List</CardTitle>
          <CardDescription>
            {totalCount > 0
              ? `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount.toLocaleString()} customers`
              : 'No customers found'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No customers found</p>
              {debouncedSearch && (
                <p className="text-sm mt-1">Try adjusting your search query</p>
              )}
              {!debouncedSearch && totalCount === 0 && (
                <Button variant="outline" size="sm" onClick={syncCustomers} className="mt-4">
                  <Download className="h-4 w-4 mr-2" />
                  Sync Customers from API
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => {
                const isExpanded = expandedCustomers.has(customer.id);
                
                return (
                  <div key={customer.id} className="border rounded-lg overflow-hidden bg-card">
                    {/* Customer Row */}
                    <div 
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleCustomerExpand(customer.id, customer.external_id)}
                    >
                      {/* Expand Button */}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Customer Info */}
                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 items-center">
                        {/* Name - 2 lines */}
                        <div className="md:col-span-1">
                          <p className="font-medium text-foreground truncate">
                            {customer.name?.split(' ')[0] || 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {customer.name?.split(' ').slice(1).join(' ') || ''}
                          </p>
                        </div>

                        {/* Email & Phone - 2 lines */}
                        <div className="md:col-span-2 flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground truncate">
                              {customer.email || '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground truncate">
                              {customer.telephone || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Store */}
                        <div className="md:col-span-1">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            <StoreIcon className="h-3 w-3 mr-1" />
                            {getStoreName(customer.user_id)}
                          </Badge>
                        </div>

                        {/* Date */}
                        <div className="md:col-span-1 text-sm text-muted-foreground">
                          {formatDate(customer.shopify_created_at)}
                        </div>
                      </div>

                      {/* Order Stats - 2 rows stacked */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[80px]">
                        <Badge variant={customer.orderCount > 0 ? 'default' : 'secondary'} className="text-xs">
                          {customer.orderCount} orders
                        </Badge>
                        <span className="font-medium text-foreground text-sm">
                          {formatCurrency(customer.totalSpent)}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Order History */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Order History ({customer.orderCount} orders)
                        </h4>
                        
                        {loadingOrders.has(customer.id) ? (
                          <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 w-full" />
                            ))}
                          </div>
                        ) : customer.orders.length === 0 && customer.orderCount === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            No orders found for this customer
                          </p>
                        ) : customer.orders.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Loading orders...
                          </p>
                        ) : (
                          <div className="rounded-md border bg-background overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[140px]">Order #</TableHead>
                                  <TableHead className="w-[120px]">Date</TableHead>
                                  <TableHead className="w-[180px]">Location</TableHead>
                                  <TableHead className="w-[100px]">Status</TableHead>
                                  <TableHead className="w-[80px]">Opt-In</TableHead>
                                  <TableHead className="w-[100px] text-right">Amount</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {customer.orders.slice(0, 10).map((order) => {
                                  const storeName = getStoreName(customer.user_id);
                                  const hasPortal = !!getReturnPortalUrl(storeName, customer.email || '', order.name || order.external_id);
                                  return (
                                    <TableRow 
                                      key={order.id}
                                      className={hasPortal ? 'cursor-pointer hover:bg-muted/50' : ''}
                                      onClick={() => hasPortal && handleOrderClick(customer, order)}
                                    >
                                      <TableCell className="font-medium">
                                        <span className="flex items-center gap-1.5">
                                          {order.name || order.external_id}
                                          {hasPortal && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {formatDate(order.shopify_created_at)}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {order.city && order.country 
                                          ? `${order.city}, ${order.country}`
                                          : order.city || order.country || '—'}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-xs capitalize">
                                          {order.payment_status || 'unknown'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Badge 
                                          variant={order.opt_in ? 'default' : 'secondary'}
                                          className="text-xs"
                                        >
                                          {order.opt_in ? 'Yes' : 'No'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(order.total_price || 0)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                {customer.orders.length > 10 && (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-3">
                                      ... and {customer.orders.length - 10} more orders
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Customers;
