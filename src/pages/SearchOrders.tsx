import { useState } from "react";
import { Loader2, ArrowLeft, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import kvattLogo from "@/assets/kvatt-logo.jpeg";

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

function SupportFooter() {
  return (
    <div className="mt-auto pt-16 pb-8">
      <p className="text-sm font-semibold text-stone-700 mb-3">Need support:</p>
      <div className="flex flex-col gap-1.5 text-sm text-stone-600">
        <p>
          <span className="font-semibold">email:</span>{" "}
          <a href="mailto:returns@kvatt.com" className="hover:text-stone-900 transition-colors">
            returns@kvatt.com
          </a>
        </p>
        <p>
          <span className="font-semibold">whatsapp:</span>{" "}
          <a href="https://wa.me/447549884850" target="_blank" rel="noopener noreferrer" className="hover:text-stone-900 transition-colors">
            +44 (0) 75.49.88.48.50
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SearchOrders() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [step, setStep] = useState<'start' | 'search' | 'results'>('start');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setOrders([]);
    setCustomer(null);
    setSearched(true);
    setSelectedOrderId(null);

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
        setError(data?.message || "No orders found for this email");
        setLoading(false);
        setStep('results');
        return;
      }

      setCustomer({
        external_id: data.customer.id,
        name: data.customer.name,
        email: data.customer.email,
        telephone: data.customer.telephone,
      });

      setOrders(data.orders || []);
      setStep('results');
    } catch (err) {
      setError("An error occurred while searching");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'results') {
      setStep('search');
      setSearched(false);
      setError(null);
      setOrders([]);
      setCustomer(null);
      setSelectedOrderId(null);
    } else if (step === 'search') {
      setStep('start');
    }
  };

  const handleConfirmReturn = () => {
    if (!selectedOrderId || !customer) return;
    const selectedOrder = orders.find(o => o.id === selectedOrderId);
    if (!selectedOrder) return;
    const returnUrl = getReturnPortalUrl(selectedOrder, customer.email);
    if (returnUrl) {
      window.open(returnUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const hasReturnUrl = selectedOrder && customer ? !!getReturnPortalUrl(selectedOrder, customer.email) : false;

  // Group orders by store
  const ordersByStore = orders.reduce<Record<string, OrderResult[]>>((acc, order) => {
    const store = getStoreName(order.user_id);
    if (!acc[store]) acc[store] = [];
    acc[store].push(order);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#e8e4de' }}>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 py-8">

        {/* Back button */}
        {(step === 'results' || step === 'search') && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900 transition-colors mb-4 self-start font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            back
          </button>
        )}

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img
            src={kvattLogo}
            alt="Kvatt"
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* STEP 0: What are you returning? */}
        {step === 'start' && (
          <div className="flex flex-col flex-1">
            <h1 className="text-3xl font-bold text-stone-900 mb-10 leading-tight">
              What are you<br />returning?
            </h1>

            <div className="space-y-4 w-full max-w-sm">
              <button
                onClick={() => setStep('search')}
                className="w-full py-4 bg-stone-900 text-white rounded-lg text-base font-medium hover:bg-stone-800 transition-colors"
              >
                An item from my order
              </button>
              <button
                onClick={() => setStep('search')}
                className="w-full py-4 bg-stone-900 text-white rounded-lg text-base font-medium hover:bg-stone-800 transition-colors"
              >
                Just the pack (nothing inside)
              </button>
            </div>

            <SupportFooter />
          </div>
        )}

        {/* STEP 1: Search */}
        {step === 'search' && (
          <div className="flex flex-col items-center flex-1">
            <h1 className="text-3xl font-bold text-stone-900 mb-8 text-center">
              Let's find your order
            </h1>

            <form onSubmit={handleSearch} className="w-full space-y-4">
              <input
                type="email"
                placeholder="enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-stone-300 bg-transparent text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 text-base"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 bg-stone-900 text-white rounded-full text-base font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                find order
              </button>
            </form>

            <SupportFooter />
          </div>
        )}

        {/* STEP 2: Results */}
        {step === 'results' && (
          <div className="flex flex-col flex-1">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-stone-500" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center flex-1">
                <h1 className="text-2xl font-bold text-stone-900 mb-2 text-center">
                  No orders found
                </h1>
                <p className="text-stone-500 text-sm text-center mb-6">
                  {error}
                </p>
                <button
                  onClick={handleBack}
                  className="py-3 px-8 bg-stone-900 text-white rounded-full text-base font-medium hover:bg-stone-800 transition-colors"
                >
                  try again
                </button>
                <SupportFooter />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center flex-1">
                <h1 className="text-2xl font-bold text-stone-900 mb-2 text-center">
                  No orders found
                </h1>
                <p className="text-stone-500 text-sm text-center mb-6">
                  We couldn't find any orders for this email
                </p>
                <button
                  onClick={handleBack}
                  className="py-3 px-8 bg-stone-900 text-white rounded-full text-base font-medium hover:bg-stone-800 transition-colors"
                >
                  try again
                </button>
                <SupportFooter />
              </div>
            ) : (
              <>
                <p className="text-sm text-stone-500 text-center mb-1">we found a match!</p>
                <h1 className="text-2xl font-bold text-stone-900 mb-6 text-center">
                  Select your order below
                </h1>

                <div className="space-y-6 mb-6">
                  {Object.entries(ordersByStore).map(([storeName, storeOrders]) => (
                    <div key={storeName}>
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                        {storeName}
                      </p>
                      <div className="space-y-2">
                        {storeOrders.map((order) => {
                          const isSelected = selectedOrderId === order.id;
                          return (
                            <button
                              key={order.id}
                              onClick={() => setSelectedOrderId(order.id)}
                              className={`w-full text-left p-4 rounded-lg border transition-all ${
                                isSelected
                                  ? 'border-stone-900 bg-stone-100'
                                  : 'border-stone-300 hover:border-stone-400'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                      isSelected ? 'border-stone-900' : 'border-stone-400'
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="h-2.5 w-2.5 rounded-full bg-stone-900" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-stone-900 text-sm">
                                      {order.name}
                                    </p>
                                    <p className="text-xs text-stone-500">
                                      {order.shopify_created_at
                                        ? format(new Date(order.shopify_created_at), "MMM d, yyyy")
                                        : "N/A"}
                                    </p>
                                  </div>
                                </div>
                                <p className="font-semibold text-stone-900">
                                  £{(order.total_price || 0).toFixed(2)}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleConfirmReturn}
                  disabled={!selectedOrderId || !hasReturnUrl}
                  className="w-full py-3 bg-stone-900 text-white rounded-full text-base font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  confirm & start return
                </button>

                {selectedOrderId && !hasReturnUrl && (
                  <p className="text-xs text-stone-500 text-center mt-2">
                    Return portal not available for this store
                  </p>
                )}

                <SupportFooter />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
