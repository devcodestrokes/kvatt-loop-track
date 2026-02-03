import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, ChevronLeft, ChevronRight, RefreshCw, Mail, Phone, Store as StoreIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MultiStoreSelector } from '@/components/dashboard/MultiStoreSelector';
import { useStoreFilter } from '@/hooks/useStoreFilter';
import { Store as StoreType } from '@/types/analytics';

interface Customer {
  id: number;
  user_id: number;
  shopify_customer_id: string;
  name: string;
  email: string;
  telephone: string | null;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  
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
      setCurrentPage(1); // Reset to page 1 when searching
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchCustomers = useCallback(async (page: number = 1) => {
    // Don't fetch if stores aren't initialized yet
    if (!isInitialized) return;
    
    setIsLoading(true);
    
    try {
      // Get the first selected store or undefined for all stores
      const storeId = selectedStores.length === 1 ? selectedStores[0] : undefined;
      
      const { data, error } = await supabase.functions.invoke('fetch-customers-api', {
        body: {
          page,
          store: storeId,
          search: debouncedSearch || undefined,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setCustomers(data.data || []);
        setPagination(data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch customers');
      }
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
  }, [selectedStores, debouncedSearch, toast, isInitialized]);

  // Fetch customers when page, store, or search changes
  useEffect(() => {
    if (isInitialized) {
      fetchCustomers(currentPage);
    }
  }, [currentPage, selectedStores, debouncedSearch, fetchCustomers, isInitialized]);

  const handlePrevPage = () => {
    if (pagination && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination && currentPage < pagination.last_page) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleRefresh = () => {
    fetchCustomers(currentPage);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStoreName = (userId: number) => {
    const name = storeNameMapping.get(userId.toString());
    return name || `Store ${userId}`;
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
            View and search customer data across all stores
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
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid gap-4 md:grid-cols-3">
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
                {pagination ? pagination.total.toLocaleString() : '—'}
              </p>
            </div>
            <Users className="h-8 w-8 text-kvatt-terracotta/20" />
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Customer List</CardTitle>
          <CardDescription>
            {pagination
              ? `Showing ${pagination.from || 0} to ${pagination.to || 0} of ${pagination.total.toLocaleString()} customers`
              : 'Loading customers...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[250px]">Email</TableHead>
                  <TableHead className="w-[150px]">Phone</TableHead>
                  <TableHead className="w-[120px]">Store</TableHead>
                  <TableHead className="w-[180px]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8" />
                        <p>No customers found</p>
                        {debouncedSearch && (
                          <p className="text-sm">Try adjusting your search query</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{customer.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.telephone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{customer.telephone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <StoreIcon className="h-3 w-3 mr-1" />
                          {getStoreName(customer.user_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(customer.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.current_page} of {pagination.last_page}
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
                  disabled={currentPage >= pagination.last_page || isLoading}
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
