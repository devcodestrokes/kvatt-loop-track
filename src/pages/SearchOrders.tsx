import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, ChevronLeft, Square, Play, Pause, Send, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import kvattLogo from "@/assets/kvatt-bird-logo.png";

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
  '30': 'SCALES SwimSkins'
};

interface MerchantConfig {
  name: string;
  return_link: string | null;
  return_link_params: string | null;
  logo_url: string | null;
  contact_email: string | null;
}

// Dynamic merchant configs loaded from DB
let merchantConfigs: Record<string, MerchantConfig> = {};

const getStoreName = (userId: string | null): string => {
  if (!userId) return "N/A";
  // Use DB config name if available, else fallback to static map
  if (merchantConfigs[userId]?.name) return merchantConfigs[userId].name;
  return STORE_MAPPINGS[userId] || `Store ${userId}`;
};

const extractOrderNumber = (orderName: string): string => {
  return orderName.replace(/^#/, '');
};

const getReturnPortalUrl = (order: OrderResult, customerEmail: string): string | null => {
  const userId = order.user_id;
  const config = merchantConfigs[userId];
  const orderId = extractOrderNumber(order.name || '');

  if (config?.return_link) {
    let url = config.return_link;
    if (config.return_link_params) {
      url += config.return_link_params
        .replace('{email}', encodeURIComponent(customerEmail))
        .replace('{order_number}', encodeURIComponent(orderId));
    }
    return url;
  }

  return null;
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
    <div className="mt-24 text-left" style={{ letterSpacing: '-0.04em', lineHeight: '1.6', color: '#1c1917' }}>
      <p className="font-medium" style={{ fontSize: '24px', marginTop: '5px', marginBottom: '20px' }}>
        <span className="md:inline hidden" style={{ fontSize: '24px' }}>Need support:</span>
        <span className="md:hidden" style={{ fontSize: '18px' }}>Need support:</span>
      </p>
      <div className="flex flex-col" style={{ lineHeight: '1.6' }}>
        <p className="md:text-[24px] text-[18px]">
          <span className="font-medium" style={{ marginRight: '10px' }}>email:</span>{"    "}
          <a href="mailto:returns@kvatt.com" className="font-light hover:underline">returns@kvatt.com</a>
        </p>
        <p className="md:text-[25px] text-[18px]">
          <span className="font-medium" style={{ marginRight: '10px' }}>whatsapp:</span>{"    "}
          <a href="https://wa.me/447549884850" target="_blank" rel="noopener noreferrer" className="font-light hover:underline">+44 (0) 75.49.88.48.50</a>
        </p>
      </div>
    </div>);
}

export default function SearchOrders() {
  const [searchParams] = useSearchParams();
  const packId = searchParams.get('packId');
  const storeId = searchParams.get('storeId');
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [step, setStep] = useState<'start' | 'search' | 'results' | 'pack' | 'feedback' | 'recording'>('start');
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [activeMerchantLogo, setActiveMerchantLogo] = useState<string | null>(null);
  const [packMerchantEmail, setPackMerchantEmail] = useState<string | null>(null);
  const [packMerchantDomain, setPackMerchantDomain] = useState<string | null>(null);
  const [preloading, setPreloading] = useState(true);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);

  // Preload: animate progress bar while loading merchant configs
  useEffect(() => {
    if (!preloading) return;
    const interval = setInterval(() => {
      setPreloadProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [preloading]);

  const finishPreload = useCallback(() => {
    setPreloadProgress(100);
    setTimeout(() => setPreloading(false), 400);
  }, []);

  // Load merchant configs from DB on mount
  useEffect(() => {
    let configsLoaded = false;
    let merchantResolved = false;
    const needsMerchantResolve = !!packId;

    const checkDone = () => {
      if (configsLoaded && (!needsMerchantResolve || merchantResolved)) {
        finishPreload();
      }
    };

    supabase.functions.invoke('get-merchant-configs').then(({ data }) => {
      if (data?.success && data?.configs) {
        merchantConfigs = data.configs;
        if (storeId && merchantConfigs[storeId]?.logo_url) {
          setActiveMerchantLogo(merchantConfigs[storeId].logo_url);
        }
        if (storeId && merchantConfigs[storeId]?.contact_email) {
          setPackMerchantEmail(merchantConfigs[storeId].contact_email);
        }
      }
      configsLoaded = true;
      checkDone();
    }).catch(err => {
      console.error('Failed to load merchant configs:', err);
      configsLoaded = true;
      checkDone();
    });

    // Resolve merchant from packId via Mintsoft product name mapping
    if (packId) {
      supabase.functions.invoke('resolve-pack-merchant', {
        body: { packId }
      }).then(({ data }) => {
        if (data?.success && data?.merchant) {
          if (data.merchant.logo_url) {
            setActiveMerchantLogo(data.merchant.logo_url);
          }
          if (data.merchant.contact_email) {
            setPackMerchantEmail(data.merchant.contact_email);
          }
          if (data.merchant.shopify_domain) {
            setPackMerchantDomain(data.merchant.shopify_domain);
          }
          console.log('Pack merchant resolved:', data.merchant.name, 'domain:', data.merchant.shopify_domain);
        }
        merchantResolved = true;
        checkDone();
      }).catch(err => {
        console.error('Failed to resolve pack merchant:', err);
        merchantResolved = true;
        checkDone();
      });
    }

    // Fallback: if nothing loads within 6s, finish anyway
    const fallback = setTimeout(() => finishPreload(), 6000);
    return () => clearTimeout(fallback);
  }, [storeId, packId, finishPreload]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSent, setRecordingSent] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(60);
      setAudioBlob(null);
      setRecordingSent(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev - 1 <= 0) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setIsPaused(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  }, [isRecording, isPaused]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const saveFeedbackToDb = useCallback(async (recordingFile?: string) => {
    const orderRef = selectedOrderId ? extractOrderNumber(orders.find(o => o.id === selectedOrderId)?.name || 'unknown') : 'unknown';
    try {
      await supabase.from('customer_feedback').insert({
        order_ref: orderRef,
        sentiment_value: sliderValue,
        recording_path: recordingFile || null,
      });
    } catch (err) {
      console.error('Failed to save feedback:', err);
    }
  }, [selectedOrderId, orders, sliderValue]);

  const sendRecording = useCallback(async () => {
    if (!audioBlob) return;
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const orderRef = selectedOrderId ? extractOrderNumber(orders.find(o => o.id === selectedOrderId)?.name || 'unknown') : 'unknown';
      const fileName = `feedback_${orderRef}_${timestamp}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('voice-feedback')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload failed:', uploadError);
        return;
      }
      await saveFeedbackToDb(fileName);
      setRecordingSent(true);
    } catch (err) {
      console.error('Failed to send recording:', err);
    }
  }, [audioBlob, selectedOrderId, orders, saveFeedbackToDb]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Record QR scan when packId is present
  useEffect(() => {
    if (packId) {
      supabase.functions.invoke('record-qr-scan', {
        body: { packId }
      }).then(({ data, error }) => {
        if (error) console.error('Failed to record QR scan:', error);
        else console.log('QR scan recorded for:', packId);
      });
    }
  }, [packId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setOrders([]);
    setCustomer(null);
    setSearched(true);
    setSelectedOrderId(null);
    setShowAllOrders(false);
    try {
      const searchBody: Record<string, unknown> = { email: email.trim() };
      // When accessed via pack QR, filter to that retailer's opt-in orders only
      if (packId && packMerchantDomain) {
        searchBody.store_domain = packMerchantDomain;
        searchBody.opt_in_only = true;
      }
      const { data, error: fnError } = await supabase.functions.invoke('search-orders-by-email', {
        body: searchBody
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
        telephone: data.customer.telephone
      });

      setOrders(data.orders || []);
      // Set active merchant logo from first order's merchant config
      const firstUserId = data.orders?.[0]?.user_id;
      if (firstUserId && merchantConfigs[firstUserId]?.logo_url) {
        setActiveMerchantLogo(merchantConfigs[firstUserId].logo_url);
      }
      setStep('results');
    } catch (err) {
      setError("An error occurred while searching");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'recording') {
      stopRecording();
      setStep('feedback');
    } else if (step === 'feedback') {
      setStep('results');
    } else if (step === 'results') {
      setStep('search');
      setSearched(false);
      setError(null);
      setOrders([]);
      setCustomer(null);
      setSelectedOrderId(null);
      setShowAllOrders(false);
      if (!storeId) setActiveMerchantLogo(null);
    } else if (step === 'search' || step === 'pack') {
      setStep('start');
    }
  };

  const handleConfirmReturn = () => {
    if (!selectedOrderId || !customer) return;
    const selectedOrder = orders.find((o) => o.id === selectedOrderId);
    if (!selectedOrder) return;
    const returnUrl = getReturnPortalUrl(selectedOrder, customer.email);
    if (returnUrl) {
      window.open(returnUrl, '_blank', 'noopener,noreferrer');
    }
    // Navigate to feedback step
    setStep('feedback');
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const hasReturnUrl = selectedOrder && customer ? !!getReturnPortalUrl(selectedOrder, customer.email) : false;

  const ordersByStore = orders.reduce<Record<string, OrderResult[]>>((acc, order) => {
    const store = getStoreName(order.user_id);
    if (!acc[store]) acc[store] = [];
    acc[store].push(order);
    return acc;
  }, {});

  if (preloading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#e8e4de', fontFamily: "'Inter', sans-serif" }}>
        <img
          src={kvattLogo}
          alt="Kvatt"
          className="w-[80px] h-[69px] md:w-[100px] md:h-[86px] object-contain mb-8"
        />
        <div className="w-[160px] h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(28, 25, 23, 0.15)' }}>
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${preloadProgress}%`,
              backgroundColor: '#1c1917',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#e8e4de', fontFamily: "'Inter', sans-serif" }}>
      {/* Top section: back button then logo below it */}
      <div className="px-6 pt-6">
        {(step !== 'start') ? (
          <button
            onClick={handleBack}
            style={{ fontSize: '18px', fontWeight: 400, letterSpacing: '-0.0425em' }}
            className="flex items-center gap-1 text-stone-900 hover:text-stone-700 transition-colors mb-3">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            back
          </button>
        ) : (
          <div style={{ height: '27px' }} />
        )}
        <div className="flex items-center justify-center gap-4 pb-4">
          <img
            src={kvattLogo}
            alt="Kvatt"
            className="object-contain md:w-[70px] md:h-[60px] w-[50px] h-[43px]" />
          {activeMerchantLogo && (
              <img
                src={activeMerchantLogo}
                alt="Merchant"
                className="object-contain md:h-[60px] h-[43px] max-w-[150px]" />
          )}
        </div>
      </div>

      {/* Middle content - vertically centered in remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">

        {/* STEP 0: What are you returning? */}
        {step === 'start' &&
        <div className="w-full">  
            <h1
            style={{ lineHeight: '105%', letterSpacing: '-0.04em' }}
            className="text-stone-900 mb-10 md:text-[52px] text-[36px] md:font-medium font-medium">

              What are you<br />returning?
            </h1>

            <div className="w-full flex flex-col gap-[31px] md:gap-[44px] md:max-w-[476px]">
              <button
              onClick={() => setStep('search')}
              style={{ letterSpacing: '-0.04em' }}
              className="w-full md:h-[62px] md:text-[20px] h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors">

                An item from my order
              </button>
              <button
              onClick={() => setStep('pack')}
              style={{ letterSpacing: '-0.04em' }}
              className="w-full md:h-[62px] md:text-[20px] h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors">

                Just the pack (nothing inside)
              </button>
            </div>
            <SupportFooter />
          </div>
        }

        {/* PACK STEP: Just the pack flow */}
        {step === 'pack' &&
        <div className="w-full">
            <h1
            style={{ lineHeight: '100%', letterSpacing: '-0.04em' }}
            className="text-stone-900 mb-14 md:text-[48px] text-[44px] md:font-medium font-medium">
              Thanks for returning<br />the empty pack!
            </h1>
            <div
            style={{ fontSize: '24px', fontWeight: 400, lineHeight: '130%', letterSpacing: '-0.0425em' }}
            className="text-stone-900 mb-10">

              <p className="mb-4">
                Use the prepaid label from your <b>one tap return kit envelope.</b>
              </p>
              <p>
                Stick it on the packaging and drop it in any UK Royal Mail postbox.
              </p>
              <br/>
              <p><b>
                Please don't use tape on the packaging so we can reuse it.
              </b></p>
            </div>

            <button
            onClick={() => window.open('https://www.royalmail.com/services-near-you#/', '_blank', 'noopener,noreferrer')}
            style={{ letterSpacing: '-0.04em' }}
            className="w-full md:h-[64px] md:text-[20px] md:max-w-[576px] h-[54px] max-w-[418px] mx-auto text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center">

              find a postbox near me
            </button>
            <SupportFooter />
          </div>
        }

        {/* STEP 1: Search */}
        {step === 'search' &&
        <div className="w-full">
            <h1
            style={{ lineHeight: '100%', letterSpacing: '-0.04em' }}
            className="text-stone-900 mb-4 md:text-[40px] text-[36px] md:font-medium font-medium">

              Let's find<br />your order
            </h1>

            <form onSubmit={handleSearch} className="w-full space-y-3">
              <input
              type="email"
              placeholder="enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ fontSize: '16px', letterSpacing: '-0.0425em' }}
              className="w-full my-8 md:px-6 px-8 py-4 rounded-full border-0 bg-white/60 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 text-center block"
              autoFocus />


              <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{ letterSpacing: '-0.04em' }}
              className="w-full md:py-4 md:text-[20px] md:h-auto h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">

                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                find order
              </button>
            </form>
            <SupportFooter />
          </div>
        }

        {/* STEP 2: Results */}
        {step === 'results' &&
        <div className="w-full">
            {loading ?
          <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-stone-500" />
              </div> :
          error ?
          <div className="w-full text-left">
                <h1
                  style={{ lineHeight: '120%', letterSpacing: '-0.04em' }}
                  className="text-stone-900 mb-6 md:text-[40px] text-[36px] md:font-medium font-medium">
                  We can't find<br />your order.
                </h1>
                <div
                  style={{ fontSize: '18px', fontWeight: 400, lineHeight: '150%', letterSpacing: '-0.0425em' }}
                  className="text-stone-900 mb-10 space-y-4">
                  <p>This return service only works for orders delivered in returnable packaging.</p>
                  <p>If your order arrived in standard packaging, you'll need to return it through the brand's usual process.</p>
                  <p>Get in touch and we'll sort it out.</p>
                </div>
                <button
                  onClick={() => window.location.href = `mailto:${packMerchantEmail || 'returns@kvatt.com'}`}
                  style={{ letterSpacing: '-0.04em' }}
                  className="w-full md:h-[62px] md:text-[20px] h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center">
                  contact brand
                </button>
              </div> :
          orders.length === 0 ?
          <div className="w-full text-left">
                <h1
                  style={{ lineHeight: '120%', letterSpacing: '-0.04em' }}
                  className="text-stone-900 mb-6 md:text-[40px] text-[36px] md:font-medium font-medium">
                  We can't find<br />your order.
                </h1>
                <div
                  style={{ fontSize: '18px', fontWeight: 400, lineHeight: '150%', letterSpacing: '-0.0425em' }}
                  className="text-stone-900 mb-10 space-y-4">
                  <p>This return service only works for orders delivered in returnable packaging.</p>
                  <p>If your order arrived in standard packaging, you'll need to return it through the brand's usual process.</p>
                  <p>Get in touch and we'll sort it out.</p>
                </div>
                <button
                  onClick={() => window.location.href = `mailto:${packMerchantEmail || 'returns@kvatt.com'}`}
                  style={{ letterSpacing: '-0.04em' }}
                  className="w-full md:h-[62px] md:text-[20px] h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center">
                  contact brand
                </button>
              </div> :

          <>
                <p
              style={{ fontSize: '26px', fontWeight: 400, letterSpacing: '-0.0425em' }}
              className="text-black mb-2">

                  We found a match!
                </p>
                <h1
              style={{ lineHeight: '105%', letterSpacing: '-0.04em' }}
              className="text-stone-900 mb-5 md:text-[52px] text-[36px] md:font-medium font-medium">

                  Select your<br />order below
                </h1>

                <div className="space-y-3 mb-5">
                  {(showAllOrders ? orders : orders.slice(0, 2)).map((order) => {
                const isSelected = selectedOrderId === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left gap-5 rounded-2xl transition-all ${
                    isSelected ?
                    'border-2 border-stone-900 bg-[#ddd9d1]' :
                    'border border-stone-300/50 bg-[#ddd9d1]/60'
                    }`}
                    style={{ padding: '16px 20px' }}>

                        <div className="flex items-center gap-10">
                          <div
                        className={`flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-stone-900' : 'border-stone-400'
                        }`}
                        style={{ width: '20px', height: '20px' }}>

                            {isSelected &&
                        <div className="rounded-full bg-stone-900" style={{ width: '12px', height: '12px' }} />
                        }
                          </div>
                          <div style={{ letterSpacing: '-0.0425em' }}>
                            <p
                          className="text-stone-900"
                          style={{ fontSize: '15px', fontWeight: 500, lineHeight: '1.5' }}>

                              #{extractOrderNumber(order.name || '')}
                            </p>
                            <p
                          className="text-stone-900"
                          style={{ fontSize: '15px', fontWeight: 400, lineHeight: '1.5' }}>

                             <span className="font-bold">date:</span> {order.shopify_created_at ?
                          format(new Date(order.shopify_created_at), "dd.MM.yyyy") :
                          "N/A"}
                            </p>
                            <p
                          className="text-stone-900"
                          style={{ fontSize: '15px', fontWeight: 400, lineHeight: '1.5' }}>

                              <span className="font-bold">amount:</span> £{Math.round(order.total_price || 0)}
                            </p>
                          </div>
                        </div>
                      </button>);

              })}
                  {orders.length > 2 && !showAllOrders && (
                    <button
                      onClick={() => setShowAllOrders(true)}
                      style={{ fontSize: '15px', fontWeight: 500, letterSpacing: '-0.0425em' }}
                      className="w-full py-3 text-stone-600 hover:text-stone-900 transition-colors underline underline-offset-4">
                      show {orders.length - 2} more order{orders.length - 2 > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                <button
              onClick={handleConfirmReturn}
              disabled={!selectedOrderId || !hasReturnUrl}
              style={{ letterSpacing: '-0.04em' }}
              className="w-full md:py-4 md:text-[20px] md:h-auto h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

                  confirm & start return
                </button>

                {selectedOrderId && !hasReturnUrl &&
            <p className="text-xs text-stone-500 text-center mt-2">
                    Return portal not available for this store
                  </p>
            }
              </>
          }
            <SupportFooter />
          </div>
        }

        {/* FEEDBACK STEP: Tell us how you feel */}
        {step === 'feedback' &&
          <div className="w-full text-left">
            <h1
              style={{ lineHeight: '105%', letterSpacing: '-0.04em' }}
              className="text-stone-900 mb-6 md:text-[58px] text-[40px] md:font-medium font-medium">
              Tell us how your feel
            </h1>
            <div
              style={{ fontSize: '22px', fontWeight: 400, lineHeight: '150%', letterSpacing: '-0.0425em' }}
              className="text-stone-900 mb-11 space-y-4">
              <p>Your experience matters so much as we learn how to improve our service.</p>
              <p>If anything feels off or great, we'd love to hear about it!</p>
            </div>

            {/* Emoji Sentiment Slider */}
            <div className="m-2">
              {/* Large emojis at top */}
              <div className="flex items-center justify-between mb-3 mx-3">
                <span className="text-4xl md:text-5xl leading-none block" style={{ lineHeight: 1 }}>😤</span>
                <span className="text-4xl md:text-5xl leading-none block" style={{ lineHeight: 1 }}>🥳</span>
              </div>

              {/* Thin divider */}
              <div className="w-auto h-[1px] bg-stone-400/50 mb-1 ml-2 mr-2" />

              {/* Slider track with pill knob */}
              <div className="relative mx-0">
                {/* Background track */}
                <div className="absolute left-2 right-2 top-1/2 h-[10px] -translate-y-1/2 bg-stone-300 rounded-full shadow-inner" />

                {/* Filled (black) track - left portion */}
                <div
                  className="absolute left-2 top-1/2 h-[10px] -translate-y-1/2 bg-stone-800 rounded-full transition-all duration-200"
                  style={{ width: `calc((100% - 16px) * ${sliderValue / 4})` }}
                />

                {/* Range input */}
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                  className="absolute left-2 right-2 w-auto appearance-none bg-transparent cursor-pointer h-12 m-0 z-10
                    [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-[10px]
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-16 [&::-webkit-slider-thumb]:h-10
                    [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:shadow-[0_2px_10px_rgba(0,0,0,0.15),0_0_3px_rgba(0,0,0,0.06)]
                    [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-stone-100 [&::-webkit-slider-thumb]:-mt-[15px]
                    [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-[10px]
                    [&::-moz-range-thumb]:w-16 [&::-moz-range-thumb]:h-10
                    [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:shadow-[0_2px_10px_rgba(0,0,0,0.15),0_0_3px_rgba(0,0,0,0.06)]
                    [&::-moz-range-thumb]:border-0"
                />

                <div className="h-12" />
              </div>

              {/* Step dots below slider */}
              <div className="relative h-4 mt-1" style={{ marginLeft: '30px', marginRight: '30px' }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="absolute w-[7px] h-[7px] rounded-full transition-all duration-300 ease-out"
                    style={{
                      left: `${(i / 4) * 100}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: i <= sliderValue ? '#292524' : 'rgba(168, 162, 158, 0.7)',
                      opacity: i === sliderValue ? 0 : 1,
                      scale: i === sliderValue ? '0' : '1',
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setStep('recording');
                startRecording();
              }}
              style={{ letterSpacing: '-0.04em' }}
              className="w-full md:h-[62px] md:text-[20px] mt-11 h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center">
              record your feedback
            </button>
            <SupportFooter />
          </div>
        }

        {/* RECORDING STEP: Voice recorder */}
        {step === 'recording' &&
          <div className="w-full text-left">
            <h1
              style={{ lineHeight: '105%', letterSpacing: '-0.04em' }}
              className="text-stone-900 mb-8 md:text-[52px] text-[36px] md:font-medium font-medium">
              {recordingSent ? 'Thank you!' : (isRecording || audioBlob) ? 'Thank you!' : 'Thank you!'}
            </h1>

            {recordingSent ? (
              <div
                style={{ fontSize: '18px', fontWeight: 400, lineHeight: '150%', letterSpacing: '-0.0425em' }}
                className="text-stone-900 space-y-4">
                <p>Your voice feedback has been received. We really appreciate you taking the time!</p>
              </div>
            ) : (
              <>
                {/* Recording status */}
                <div className="mb-6">
                  <p className="text-stone-900 font-medium text-[18px] mb-3" style={{ letterSpacing: '-0.04em' }}>
                    {isRecording ? (isPaused ? 'paused...' : 'recording...') : audioBlob ? 'recorded' : 'ready'}
                  </p>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-stone-300 rounded-full mb-2 relative">
                    <div
                      className="h-full bg-stone-900 rounded-full transition-all relative"
                      style={{ width: `${(recordingTime / 60) * 100}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-stone-900 rounded-full" />
                    </div>
                  </div>
                  <p className="text-stone-500 text-sm" style={{ letterSpacing: '-0.04em' }}>
                    {recordingTime} sec
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-10 mb-4">
                  <button
                    onClick={stopRecording}
                    disabled={!isRecording}
                    className="flex flex-col items-center gap-2 disabled:opacity-30 transition-transform duration-200 active:scale-90">
                    <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center">
                      <Square className="w-4 h-4 text-white fill-white" />
                    </div>
                    <span className="text-xs font-medium text-stone-900 uppercase tracking-wide">Stop</span>
                  </button>

                  <button
                    onClick={pauseRecording}
                    disabled={!isRecording}
                    className="flex flex-col items-center gap-2 disabled:opacity-30 transition-transform duration-200 active:scale-90">
                    <div className="w-14 h-14 rounded-full bg-stone-900 flex items-center justify-center transition-all duration-300">
                      {isPaused ? (
                        <Play className="w-6 h-6 text-white fill-white ml-0.5 animate-scale-in" />
                      ) : (
                        <Pause className="w-6 h-6 text-white fill-white animate-scale-in" />
                      )}
                    </div>
                    <span className="text-xs font-medium text-stone-900 uppercase tracking-wide">
                      {isPaused ? 'Play' : 'Pause'}
                    </span>
                  </button>

                  {/* Reset button - only enabled when recording is stopped and audio exists */}
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setRecordingTime(0);
                    }}
                    disabled={isRecording || !audioBlob}
                    className="flex flex-col items-center gap-2 disabled:opacity-30 transition-transform duration-200 active:scale-90">
                    <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center">
                      <RotateCcw className="w-4 h-4 text-white animate-scale-in" />
                    </div>
                    <span className="text-xs font-medium text-stone-900 uppercase tracking-wide">Reset</span>
                  </button>
                </div>

                {/* Send feedback button - enabled only when stopped with audio */}
                <button
                  onClick={sendRecording}
                  disabled={!audioBlob || isRecording}
                  className="w-full py-4 rounded-2xl bg-stone-900 text-white font-medium text-base tracking-tight disabled:opacity-30 transition-all duration-200 active:scale-[0.98] mb-8">
                  send feedback
                </button>
              </>
            )}
            <SupportFooter />
          </div>
        }
      </div>
    </div>);


}
