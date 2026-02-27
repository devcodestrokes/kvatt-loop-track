import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, ChevronLeft, Square, Circle, Pause } from "lucide-react";
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
    case 'Kvatt - Demo Store':
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
    <div className="mt-24 text-left" style={{ letterSpacing: '-0.04em', lineHeight: '1.6', color: '#1c1917' }}>
      <p className="font-medium" style={{ fontSize: '24px', marginTop: '5px', marginBottom: '20px' }}>
        <span className="md:inline hidden" style={{ fontSize: '24px' }}>Need support:</span>
        <span className="md:hidden" style={{ fontSize: '15px' }}>Need support:</span>
      </p>
      <div className="flex flex-col" style={{ lineHeight: '1.6' }}>
        <p className="md:text-[24px] text-[15px]">
          <span className="font-medium" style={{ marginRight: '10px' }}>email:</span>{"    "}
          <a href="mailto:returns@kvatt.com" className="font-light hover:underline">returns@kvatt.com</a>
        </p>
        <p className="md:text-[25px] text-[15px]">
          <span className="font-medium" style={{ marginRight: '10px' }}>whatsapp:</span>{"    "}
          <a href="https://wa.me/447549884850" target="_blank" rel="noopener noreferrer" className="font-light hover:underline">+44 (0) 75.49.88.48.50</a>
        </p>
      </div>
    </div>);
}

export default function SearchOrders() {
  const [searchParams] = useSearchParams();
  const packId = searchParams.get('packId');
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [step, setStep] = useState<'start' | 'search' | 'results' | 'pack' | 'feedback' | 'recording'>('start');
  const [showAllOrders, setShowAllOrders] = useState(false);

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
      setRecordingTime(0);
      setAudioBlob(null);
      setRecordingSent(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
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
      setRecordingSent(true);
    } catch (err) {
      console.error('Failed to send recording:', err);
    }
  }, [audioBlob, selectedOrderId, orders]);

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
      const { data, error: fnError } = await supabase.functions.invoke('search-orders-by-email', {
        body: { email: email.trim() }
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
        <div className="flex justify-center pb-4">
          <img
            src={kvattLogo}
            alt="Kvatt"
            className="object-contain md:w-[70px] md:h-[60px] w-[50px] h-[43px]" />
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
            className="text-stone-900 mb-6 md:text-[40px] text-[36px] md:font-medium font-medium">

              Thanks for returning<br />the empty pack!
            </h1>
            <div
            style={{ fontSize: '18px', fontWeight: 400, lineHeight: '130%', letterSpacing: '-0.0425em' }}
            className="text-stone-900 mb-10">

              <p className="mb-4">
                Fold it into the provided pink pouch and<br />drop it in any UK Royal Mail postbox.
              </p>
              <p>
                We will reuse it for future orders and help<br />reduce waste.
              </p>
            </div>

            <button
            onClick={() => window.open('https://www.royalmail.com/services-near-you#/', '_blank', 'noopener,noreferrer')}
            style={{ letterSpacing: '-0.04em' }}
            className="w-full md:h-[62px] md:text-[20px] md:max-w-[476px] h-[52px] max-w-[318px] mx-auto text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center">

              find a drop-off near me
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
                  onClick={() => window.location.href = 'mailto:returns@kvatt.com'}
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
                  onClick={() => window.location.href = 'mailto:returns@kvatt.com'}
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
                    className={`w-full text-left rounded-2xl transition-all ${
                    isSelected ?
                    'border-2 border-stone-900 bg-[#ddd9d1]' :
                    'border border-stone-300/50 bg-[#ddd9d1]/60'
                    }`}
                    style={{ padding: '16px 20px' }}>

                        <div className="flex items-center gap-4">
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

                              date: {order.shopify_created_at ?
                          format(new Date(order.shopify_created_at), "dd.MM.yyyy") :
                          "N/A"}
                            </p>
                            <p
                          className="text-stone-900"
                          style={{ fontSize: '15px', fontWeight: 400, lineHeight: '1.5' }}>

                              amount: £{Math.round(order.total_price || 0)}
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
              className="text-stone-900 mb-6 md:text-[52px] text-[36px] md:font-medium font-medium">
              Tell us how your feel
            </h1>
            <div
              style={{ fontSize: '18px', fontWeight: 400, lineHeight: '150%', letterSpacing: '-0.0425em' }}
              className="text-stone-900 mb-4 space-y-4">
              <p>Your experience matters so much as we learn how to improve our service.</p>
              <p>If anything feels off or great, we'd love to hear about it!</p>
              <p className="font-medium">Why are you returning? What did you enjoy? What could be better?</p>
            </div>

            <button
              onClick={() => {
                setStep('recording');
                startRecording();
              }}
              style={{ letterSpacing: '-0.04em' }}
              className="w-full md:h-[62px] md:text-[20px] mt-8 h-[52px] text-[20px] font-normal bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center">
              click to record your impression
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
                      style={{ width: `${Math.min((recordingTime / 120) * 100, 100)}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-stone-900 rounded-full" />
                    </div>
                  </div>
                  <p className="text-stone-500 text-sm" style={{ letterSpacing: '-0.04em' }}>
                    {recordingTime} sec
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-10 mb-8">
                  <button
                    onClick={stopRecording}
                    disabled={!isRecording}
                    className="flex flex-col items-center gap-2 disabled:opacity-30">
                    <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center">
                      <Square className="w-4 h-4 text-white fill-white" />
                    </div>
                    <span className="text-xs font-medium text-stone-900 uppercase tracking-wide">Stop</span>
                  </button>

                  <button
                    onClick={pauseRecording}
                    disabled={!isRecording}
                    className="flex flex-col items-center gap-2 disabled:opacity-30">
                    <div className="w-14 h-14 rounded-full bg-stone-900 flex items-center justify-center">
                      <Pause className="w-6 h-6 text-white fill-white" />
                    </div>
                    <span className="text-xs font-medium text-stone-900 uppercase tracking-wide">Pause</span>
                  </button>

                  <button
                    onClick={sendRecording}
                    disabled={!audioBlob || isRecording}
                    className="flex flex-col items-center gap-2 disabled:opacity-30">
                    <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center">
                      <Circle className="w-4 h-4 text-white fill-white" />
                    </div>
                    <span className="text-xs font-medium text-stone-900 uppercase tracking-wide">Send</span>
                  </button>
                </div>
              </>
            )}
            <SupportFooter />
          </div>
        }
      </div>
    </div>);


}
