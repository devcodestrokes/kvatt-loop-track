import { useState } from "react";
import { Loader2, ChevronLeft, Mail, Phone } from "lucide-react";
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
    <div className="mt-12 text-left" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.0425em', fontSize: '26px', lineHeight: '1.4', color: '#000000' }}>
      <p className="font-semibold mb-1" style={{ fontSize: '26px' }}>Need support:</p>
      <div className="flex flex-col" style={{ fontSize: '26px', lineHeight: '1.45' }}>
        <p>
          <span className="font-semibold">email:</span>{"   "}
          <span className="font-normal">returns@kvatt.com</span>
        </p>
        <p>
          <span className="font-semibold">whatsapp:</span>{"   "}
          <span className="font-normal">+44 (0) 75.49.88.48.50</span>
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
  const [step, setStep] = useState<'start' | 'search' | 'results' | 'pack'>('start');

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
    } else if (step === 'search' || step === 'pack') {
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
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#e8e4de' }}>
      {/* Back button - absolute top left */}
      {(step === 'results' || step === 'search' || step === 'pack') && (
        <button
          onClick={handleBack}
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '26px', fontWeight: 400, letterSpacing: '-0.0425em' }}
          className="absolute top-8 left-8 flex items-center gap-1 text-stone-900 hover:text-stone-700 transition-colors z-10"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
          back
        </button>
      )}

      {/* Fixed Logo at top */}
      <div className="flex justify-center pt-8 pb-4">
        <img
          src={kvattLogo}
          alt="Kvatt"
          style={{ width: '70px', height: '60px' }}
          className="object-contain"
        />
      </div>

      {/* Middle content - vertically centered in remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">

        {/* STEP 0: What are you returning? */}
        {step === 'start' && (
          <div className="w-full">
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
                onClick={() => setStep('pack')}
                className="w-full py-4 bg-stone-900 text-white rounded-lg text-base font-medium hover:bg-stone-800 transition-colors"
              >
                Just the pack (nothing inside)
              </button>
            </div>
            <SupportFooter />
          </div>
        )}

        {/* PACK STEP: Just the pack flow */}
        {step === 'pack' && (
          <div className="w-full">
            <h1
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '47px', fontWeight: 500, lineHeight: '100%', letterSpacing: '-0.0425em' }}
              className="text-stone-900 mb-6"
            >
              Thanks for returning<br />the empty pack!
            </h1>
            <div
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '21px', fontWeight: 400, lineHeight: '110%', letterSpacing: '-0.0425em' }}
              className="text-stone-900 mb-10"
            >
              <p className="mb-4">
                Fold it into the provided pink pouch and<br />drop it in any UK Royal Mail postbox.
              </p>
              <p>
                We will reuse it for future orders and help<br />reduce waste.
              </p>
            </div>

            <button
              onClick={() => window.open('https://www.royalmail.com/services/find-post-office', '_blank', 'noopener,noreferrer')}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '25.68px', fontWeight: 400, lineHeight: '110%', letterSpacing: '-0.0425em' }}
              className="w-full py-5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors"
            >
              find a drop-off near me
            </button>
            <SupportFooter />
          </div>
        )}

        {/* STEP 1: Search */}
        {step === 'search' && (
          <div className="w-full">
            <h1
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '49px', fontWeight: 500, lineHeight: '100%', letterSpacing: '-0.0425em' }}
              className="text-stone-900 mb-8"
            >
              Let's find<br />your order
            </h1>

            <form onSubmit={handleSearch} className="w-full space-y-3">
              <input
                type="email"
                placeholder="enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ fontFamily: 'Inter, sans-serif', fontSize: '17px', letterSpacing: '-0.0425em' }}
                className="w-full px-6 py-4 rounded-full border-0 bg-white/60 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 text-center"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{ fontFamily: 'Inter, sans-serif', fontSize: '21px', fontWeight: 400, lineHeight: '110%', letterSpacing: '-0.0425em' }}
                className="w-full py-4 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="w-full">
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-stone-500" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center">
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
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center">
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
              </div>
            ) : (
              <>
                <p
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 400, letterSpacing: '-0.0425em' }}
                  className="text-stone-500 mb-2"
                >
                  We found a match!
                </p>
                <h1
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '40px', fontWeight: 700, lineHeight: '100%', letterSpacing: '-0.0425em' }}
                  className="text-stone-900 mb-6"
                >
                  Select your<br />order below
                </h1>

                <div className="space-y-3 mb-4">
                  {orders.map((order) => {
                    const isSelected = selectedOrderId === order.id;
                    return (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`w-full text-left rounded-xl transition-all ${
                          isSelected
                            ? 'border-2 border-stone-900 bg-[#ddd9d1]'
                            : 'border border-stone-300/50 bg-[#ddd9d1]/60'
                        }`}
                        style={{ padding: '18px 20px' }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-stone-900' : 'border-stone-400'
                            }`}
                            style={{ width: '22px', height: '22px' }}
                          >
                            {isSelected && (
                              <div className="rounded-full bg-stone-900" style={{ width: '12px', height: '12px' }} />
                            )}
                          </div>
                          <div style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.0425em' }}>
                            <p
                              className="text-stone-900"
                              style={{ fontSize: '16px', fontWeight: 500, lineHeight: '1.4' }}
                            >
                              #{extractOrderNumber(order.name || '')}
                            </p>
                            <p
                              className="text-stone-700"
                              style={{ fontSize: '16px', fontWeight: 400, lineHeight: '1.4' }}
                            >
                              date: {order.shopify_created_at
                                ? format(new Date(order.shopify_created_at), "dd.MM.yyyy")
                                : "N/A"}
                            </p>
                            <p
                              className="text-stone-700"
                              style={{ fontSize: '16px', fontWeight: 400, lineHeight: '1.4' }}
                            >
                              amount: £{Math.round(order.total_price || 0)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleConfirmReturn}
                  disabled={!selectedOrderId || !hasReturnUrl}
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '21px', fontWeight: 400, lineHeight: '110%', letterSpacing: '-0.0425em' }}
                  className="w-full py-4 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  confirm & start return
                </button>

                {selectedOrderId && !hasReturnUrl && (
                  <p className="text-xs text-stone-500 text-center mt-2">
                    Return portal not available for this store
                  </p>
                )}
              </>
            )}
            <SupportFooter />
          </div>
        )}
      </div>

    </div>
  );
}
