'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading state while webhook processes
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {isLoading ? (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Processing Payment...
            </h1>
            <p className="text-gray-600">
              Please wait while we confirm your booking.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Successful!
            </h1>

            <p className="text-gray-600 mb-6">
              Your booking has been confirmed. You will receive a confirmation email shortly.
            </p>

            {bookingId && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-500">Booking Reference</p>
                <p className="font-mono text-lg font-semibold text-gray-900">
                  {bookingId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="block w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition"
              >
                Go to Dashboard
              </Link>

              <Link
                href="/bookings"
                className="block w-full bg-white text-gray-900 py-3 px-4 rounded-lg font-medium border border-gray-200 hover:bg-gray-50 transition"
              >
                View My Bookings
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Need help? Contact us at{' '}
                <a href="mailto:hello@infinity8.my" className="text-green-600 hover:underline">
                  hello@infinity8.my
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
