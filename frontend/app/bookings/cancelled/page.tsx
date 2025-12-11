'use client';

import Link from 'next/link';

export default function BookingCancelledPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-yellow-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Cancelled
        </h1>

        <p className="text-gray-600 mb-6">
          Your payment was not completed. Your booking is still pending and will be held for 15 minutes.
        </p>

        <div className="bg-yellow-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium text-yellow-800 mb-2">What happens next?</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Your booking slot is reserved for 15 minutes</li>
            <li>• You can retry the payment from your dashboard</li>
            <li>• If unpaid, the booking will be automatically cancelled</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Return to Dashboard
          </Link>

          <Link
            href="/bookings"
            className="block w-full bg-white text-gray-900 py-3 px-4 rounded-lg font-medium border border-gray-200 hover:bg-gray-50 transition"
          >
            View Pending Bookings
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Having trouble with payment? Contact us at{' '}
            <a href="mailto:hello@infinity8.my" className="text-blue-600 hover:underline">
              hello@infinity8.my
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
