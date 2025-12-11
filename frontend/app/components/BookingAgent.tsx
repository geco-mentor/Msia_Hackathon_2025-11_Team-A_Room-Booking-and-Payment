'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { useSearchParams } from 'next/navigation';

interface VirtualTourData {
  url: string;
  fullUrl?: string;
  spaceName: string;
  lat?: number;
  lng?: number;
  heading?: number;
  pitch?: number;
  panoId?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  paymentLink?: string;
  virtualTour?: VirtualTourData;
}

interface BookingSummary {
  id: string;
  space_name: string;
  date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  status: string;
}

let googleMapsPromise: Promise<any> | null = null;

const loadGoogleMapsApi = (apiKey: string) => {
  if (googleMapsPromise) return googleMapsPromise;
  if (typeof window === 'undefined') {
    googleMapsPromise = Promise.reject(new Error('Google Maps cannot load on server'));
    return googleMapsPromise;
  }
  if ((window as any).google?.maps) {
    googleMapsPromise = Promise.resolve((window as any).google);
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.onload = () => {
      const g = (window as any).google;
      if (g?.maps) resolve(g);
      else reject(new Error('Google Maps failed to initialize'));
    };
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

export default function BookingAgent() {
  const { user, session } = useAuth();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [virtualTourData, setVirtualTourData] = useState<VirtualTourData | null>(null);
  const [streetViewError, setStreetViewError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streetViewContainerRef = useRef<HTMLDivElement>(null);
  const streetViewMapRef = useRef<HTMLDivElement>(null);
  const paymentHandledRef = useRef(false);

  const BOOKING_API_URL = process.env.NEXT_PUBLIC_BOOKING_API_URL || 'http://localhost:8000';
  const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Initialize with welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: user
            ? `Hello ${user.user_metadata?.full_name || 'there'}! I'm your booking assistant. I can help you:\n\n- Find and book meeting rooms, hot desks, or private offices\n- Take 360° virtual tours of our spaces\n- Check availability for specific dates and times\n- View or manage your existing bookings\n\nWhat would you like to do today?`
            : 'Hello! Please log in to use the booking assistant.',
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, user, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-open and acknowledge successful payment redirects
  useEffect(() => {
    const status = searchParams.get('payment_status');
    const bookingId = searchParams.get('booking_id');

    if (status === 'success' && !paymentHandledRef.current) {
      paymentHandledRef.current = true;
      setIsOpen(true);

      const successMessage: Message = {
        role: 'assistant',
        content: `Payment received! Your booking${bookingId ? ` (${bookingId})` : ''} is confirmed. Would you like me to send the details or create another booking?`,
        timestamp: new Date()
      };

      setMessages(prev => {
        // Avoid duplicating the success note on refresh
        const alreadyNotified = prev.some(m => m.content.includes('Payment received!'));
        if (alreadyNotified) return prev;
        return [...prev, successMessage];
      });
    }
  }, [searchParams]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    if (!user) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Please log in to use the booking assistant. Click the "Sign in" button in the navigation bar.',
        timestamp: new Date()
      }]);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), 75000); // 75s timeout (backend has 60s)

      const response = await fetch(`${BOOKING_API_URL}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: inputMessage,
          user_id: user.id,
          conversation_id: conversationId,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          language: 'english'
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Update conversation ID
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        paymentLink: data.payment_link,
        virtualTour: data.virtual_tour ? {
          url: data.virtual_tour.url,
          fullUrl: data.virtual_tour.full_url,
          spaceName: data.virtual_tour.space_name,
          lat: data.virtual_tour.lat,
          lng: data.virtual_tour.lng,
          heading: data.virtual_tour.heading,
          pitch: data.virtual_tour.pitch,
          panoId: (data.virtual_tour as any).pano_id,
        } : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error:', error);
      const timedOut = error?.name === 'AbortError';
      const errorMessage: Message = {
        role: 'assistant',
        content: timedOut
          ? 'Sorry, the booking assistant timed out. Please try again in a moment.'
          : 'Sorry, I could not reach the booking service. Please check your connection or try again shortly.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setInputMessage(action);
  };

  const quickActions = [
    "Show me available meeting rooms",
    "I want to book a hot desk",
    "Take a virtual tour",
    "Check my bookings"
  ];

  // Render payment link button
  const renderPaymentLink = (link: string) => (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      Complete Payment
    </a>
  );

  // Open virtual tour modal
  const handleOpenVirtualTour = (tour: VirtualTourData) => {
    setVirtualTourData(tour);
    setShowVirtualTour(true);
  };

  // Build a resilient Street View embed using cbll/cbp params (avoids blank pb/world map states)
  const iframeSrc = (() => {
    if (virtualTourData?.lat && virtualTourData?.lng) {
      const heading = virtualTourData.heading ?? 0;
      const pitch = virtualTourData.pitch ?? 0;
      return `https://maps.google.com/?q=&layer=c&cbll=${virtualTourData.lat},${virtualTourData.lng}&cbp=12,${heading},0,0,${pitch}&output=svembed`;
    }
    return virtualTourData?.url ?? '';
  })();

  // Load Google Maps JS API Street View when coordinates + key available
  useEffect(() => {
    // Per request, keep using the embed (no JS Street View) to avoid black screens
    if (!showVirtualTour || !virtualTourData) return;
    setStreetViewError(null);
  }, [showVirtualTour, virtualTourData, GOOGLE_MAPS_KEY]);

  // Render virtual tour button
  const renderVirtualTourButton = (tour: VirtualTourData) => (
    <button
      onClick={() => handleOpenVirtualTour(tour)}
      className="inline-flex items-center mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      Take 360° Virtual Tour
    </button>
  );

  // Render simple markdown (bold + links) to keep chat clean and clickable
  const renderBoldSegments = (text: string, keyPrefix: string): ReactNode[] => {
    return text
      .split(/(\*\*[^*]+\*\*)/g)
      .filter(Boolean)
      .map((part, idx) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return <strong key={`${keyPrefix}-bold-${idx}`}>{boldMatch[1]}</strong>;
        }
        return <span key={`${keyPrefix}-text-${idx}`}>{part}</span>;
      });
  };

  const renderMessageContent = (content: string) => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const elements: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const [fullMatch, text, href] = match;
      const start = match.index ?? 0;

      if (start > lastIndex) {
        elements.push(...renderBoldSegments(content.slice(lastIndex, start), `text-${elements.length}`));
      }

      elements.push(
        <a
          key={`link-${elements.length}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-700 underline break-words"
        >
          {renderBoldSegments(text, `link-text-${elements.length}`)}
        </a>
      );

      lastIndex = start + fullMatch.length;
    }

    if (lastIndex < content.length) {
      elements.push(...renderBoldSegments(content.slice(lastIndex), `text-${elements.length}`));
    }

    return elements;
  };

  return (
    <>
      {/* Virtual Tour Modal */}
      {showVirtualTour && virtualTourData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl w-[90vw] h-[85vh] max-w-5xl flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">360° Virtual Tour</h3>
                  <p className="text-sm opacity-90">{virtualTourData.spaceName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowVirtualTour(false)}
                className="hover:bg-white/20 rounded-full p-2 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tour Content */}
            <div className="flex-1 relative bg-gray-900">
              <iframe
                src={iframeSrc}
                className="w-full h-full border-0"
                allow="fullscreen; geolocation *; xr-spatial-tracking; gyroscope; accelerometer"
                allowFullScreen
                style={{ pointerEvents: 'auto' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Virtual tour of ${virtualTourData.spaceName}`}
              />
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Drag to look around • Use scroll to zoom
              </p>
              <div className="flex space-x-2">
                <a
                  href={virtualTourData.fullUrl || virtualTourData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Open in Google Maps
                </a>
                <button
                  onClick={() => setShowVirtualTour(false)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Close Tour
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Agent Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-24 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-all duration-300 z-50 hover:scale-110"
        aria-label="Toggle booking agent"
        title="Book with AI"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Booking Agent Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-24 w-[420px] h-[650px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-green-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Booking Assistant</h3>
                <p className="text-xs opacity-90">Book spaces with AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded-full p-1 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Status Bar */}
          {user ? (
            <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-center text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-green-800">Logged in as {user.email}</span>
            </div>
          ) : (
            <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center text-sm">
              <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-yellow-800">Please log in to make bookings</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {renderMessageContent(message.content)}
                  </p>

                  {/* Virtual Tour Button */}
                  {message.virtualTour && renderVirtualTourButton(message.virtualTour)}

                  {/* Payment Link Button */}
                  {message.paymentLink && renderPaymentLink(message.paymentLink)}

                  <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && user && (
            <div className="px-4 py-2 bg-white border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action)}
                    className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-md hover:bg-green-100 transition"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
            <div className="flex space-x-2 items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={user ? "Type your message..." : "Please log in to chat"}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent disabled:bg-gray-100"
                disabled={isLoading || !user}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim() || !user}
                className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
