'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Space {
  id: string;
  name: string;
  type: string;
  location: string;
  capacity: number;
  hourly_rate?: number;
  daily_rate?: number;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  attendees_count: number;
  duration_type: string;
  notes?: string;
  special_requirements?: string;
  spaces?: Space;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_status: string;
  transaction_id?: string;
  paid_at?: string;
}

interface BookingStatus {
  status: string;
  booking?: Booking;
  payment_intent_id?: string;
}

export default function PaymentSuccessBanner() {
  const searchParams = useSearchParams();
  const BOOKING_API_URL = process.env.NEXT_PUBLIC_BOOKING_API_URL || 'http://localhost:8000';
  const [visible, setVisible] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'checking'>('checking');
  const [bookingData, setBookingData] = useState<Booking | null>(null);
  const [paymentData, setPaymentData] = useState<Payment | null>(null);

  useEffect(() => {
    const statusParam = searchParams.get('payment_status');
    const bookingParam = searchParams.get('booking_id');

    if (statusParam === 'success' && bookingParam) {
      setVisible(true);
      setBookingId(bookingParam);
      setStatus('checking');

      // Fetch booking details
      Promise.all([
        fetch(`${BOOKING_API_URL}/api/v1/bookings/${bookingParam}/reconcile`, { method: 'POST' }),
        fetch(`${BOOKING_API_URL}/api/v1/bookings/${bookingParam}`)
      ])
        .then(async ([reconcileRes, bookingRes]) => {
          const reconcileData: BookingStatus = await reconcileRes.json();
          const bookingDetailsData = await bookingRes.json();
          
          if (reconcileData.status === 'confirmed' || reconcileData.booking?.status === 'confirmed') {
            setStatus('confirmed');
          } else {
            setStatus('pending');
          }
          
          if (bookingDetailsData.booking) {
            setBookingData(bookingDetailsData.booking);
          }
        })
        .catch(() => setStatus('pending'));
    }
  }, [searchParams, BOOKING_API_URL]);

  if (!visible || !bookingId) return null;

  const showPending = status === 'pending' || status === 'checking';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-MY', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `RM ${amount.toFixed(2)}`;
  };

  const space = bookingData?.spaces;
  const checkInUrl = typeof window !== 'undefined' ? `${window.location.origin}/checkin/${bookingId}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setVisible(false)} />
      
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 text-white px-8 py-6">
          <button
            onClick={() => setVisible(false)}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
          
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              showPending ? 'bg-white/10 animate-pulse' : 'bg-white/20'
            }`}>
              {showPending ? (
                <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8" />
                </svg>
              ) : (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm opacity-90 font-medium">
                {showPending ? 'Processing Payment' : 'Payment Successful'}
              </p>
              <h2 className="text-3xl font-bold mt-1">
                {showPending ? 'Confirming Booking...' : 'Booking Confirmed!'}
              </h2>
              <p className="text-sm opacity-80 mt-1">
                {showPending 
                  ? 'Please wait while we finalize your reservation' 
                  : 'Your workspace has been successfully reserved'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <span className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold flex items-center">
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Payment Confirmed
            </span>
            <span className="px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
              {status === 'confirmed' ? 'Booking Active' : 'Processing'}
            </span>
            {bookingData?.duration_type && (
              <span className="px-4 py-2 rounded-full bg-purple-100 text-purple-800 text-sm font-semibold capitalize">
                {bookingData.duration_type} Booking
              </span>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Booking Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Space Details */}
              {space && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                    </svg>
                    Workspace Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{space.name}</p>
                      <p className="text-sm text-gray-600 mt-1 capitalize">{space.type} • {space.location}</p>
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <svg className="w-4 h-4 mr-2 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      Capacity: {space.capacity} {space.capacity === 1 ? 'person' : 'people'}
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Time & Details */}
              {bookingData && (
                <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Booking Schedule
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-1">Check-in</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(bookingData.start_time)}</p>
                        <p className="text-lg font-bold text-emerald-700">{formatTime(bookingData.start_time)}</p>
                      </div>
                      <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                        <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold mb-1">Check-out</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(bookingData.end_time)}</p>
                        <p className="text-lg font-bold text-rose-700">{formatTime(bookingData.end_time)}</p>
                      </div>
                    </div>

                    {bookingData.attendees_count > 0 && (
                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <span className="text-sm font-semibold text-gray-700">Attendees</span>
                        <span className="text-lg font-bold text-blue-700">{bookingData.attendees_count}</span>
                      </div>
                    )}

                    {(bookingData.notes || bookingData.special_requirements) && (
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        {bookingData.notes && (
                          <div className="mb-2">
                            <p className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{bookingData.notes}</p>
                          </div>
                        )}
                        {bookingData.special_requirements && (
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-1">Special Requirements</p>
                            <p className="text-sm text-gray-700">{bookingData.special_requirements}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              {bookingData && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-emerald-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Payment Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Booking Amount</span>
                      <span className="text-lg font-semibold text-gray-900">{formatCurrency(bookingData.total_amount)}</span>
                    </div>
                    <div className="pt-3 border-t-2 border-emerald-200 flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total Paid</span>
                      <span className="text-2xl font-bold text-emerald-700">{formatCurrency(bookingData.total_amount)}</span>
                    </div>
                    <div className="pt-2">
                      <p className="text-xs text-gray-600 flex items-center">
                        <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="16" x2="12" y2="12"/>
                          <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        Booking ID: <span className="font-mono ml-1">{bookingId}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - QR Code */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 bg-white rounded-2xl p-6 border-2 border-gray-200 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Quick Check-in</h3>
                <p className="text-sm text-gray-600 mb-4">Scan this QR code at the venue for instant access</p>
                
                <div className="bg-white p-4 rounded-2xl border-4 border-emerald-100 inline-block mb-4">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkInUrl)}&margin=10`}
                    alt="Check-in QR Code"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                </div>
                
                <div className="space-y-2 text-xs text-gray-500">
                  <p className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-1 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Valid for check-in
                  </p>
                  <p className="text-gray-400">Show this at reception</p>
                </div>

                <button 
                  onClick={() => window.print()}
                  className="mt-4 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Print QR Code
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t-2 border-gray-200">
            <a
              href="/#chat"
              className="flex-1 inline-flex items-center justify-center px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:from-emerald-700 hover:to-teal-700 transition shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              Return to Assistant
            </a>
            <button
              onClick={() => {
                if (!bookingId) return;
                setStatus('checking');
                Promise.all([
                  fetch(`${BOOKING_API_URL}/api/v1/bookings/${bookingId}/reconcile`, { method: 'POST' }),
                  fetch(`${BOOKING_API_URL}/api/v1/bookings/${bookingId}`)
                ])
                  .then(async ([reconcileRes, bookingRes]) => {
                    const reconcileData: BookingStatus = await reconcileRes.json();
                    const bookingDetailsData = await bookingRes.json();
                    
                    if (reconcileData.status === 'confirmed' || reconcileData.booking?.status === 'confirmed') {
                      setStatus('confirmed');
                    } else {
                      setStatus('pending');
                    }
                    
                    if (bookingDetailsData.booking) {
                      setBookingData(bookingDetailsData.booking);
                    }
                  })
                  .catch(() => setStatus('pending'));
              }}
              disabled={status === 'checking'}
              className="sm:w-auto px-6 py-4 rounded-xl bg-white text-emerald-700 font-bold border-2 border-emerald-200 hover:bg-emerald-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {status === 'checking' ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8" />
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Refresh Status
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
