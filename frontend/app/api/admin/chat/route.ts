import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ADMIN_SYSTEM_PROMPT = `You are an AI assistant for Infinity8 admin panel. You help administrators find and manage booking information.

IMPORTANT: You have access to real booking data through function calls. When the user asks about bookings, ALWAYS use the appropriate function to fetch real data.

Available functions:
1. search_bookings - Search for bookings by user name, email, space name, status, or date range
2. get_booking_details - Get detailed information about a specific booking by ID
3. get_booking_stats - Get booking statistics and summaries

When presenting booking information:
- Always include the booking ID
- Format dates nicely (e.g., "December 10, 2025")
- Include clickable links in this format: [View Booking](/admin/bookings/{booking_id})
- Be concise but comprehensive

STYLE:
- Professional and helpful tone
- Use bullet points for lists
- Include relevant details like user info, space, date/time, amount, status`;

// Define the functions for OpenAI
const functions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_bookings',
      description: 'Search for bookings by various criteria. Returns a list of matching bookings.',
      parameters: {
        type: 'object',
        properties: {
          search_term: {
            type: 'string',
            description: 'Search term to match against user name, email, or space name'
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            description: 'Filter by booking status'
          },
          date_from: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD format)'
          },
          date_to: {
            type: 'string',
            description: 'End date filter (YYYY-MM-DD format)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default 10)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_details',
      description: 'Get detailed information about a specific booking by its ID',
      parameters: {
        type: 'object',
        properties: {
          booking_id: {
            type: 'string',
            description: 'The UUID of the booking'
          }
        },
        required: ['booking_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_stats',
      description: 'Get booking statistics including counts by status, revenue, and recent activity',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'week', 'month', 'all'],
            description: 'Time period for statistics'
          }
        }
      }
    }
  }
];

// Function implementations
async function searchBookings(params: {
  search_term?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  const supabase = await createClient('admin');
  const limit = params.limit || 10;

  let query = supabase
    .from('bookings')
    .select('*, profiles(full_name, email), spaces(name, type, location)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.date_from) {
    query = query.gte('start_time', params.date_from);
  }

  if (params.date_to) {
    query = query.lte('start_time', params.date_to + 'T23:59:59');
  }

  const { data: bookings, error } = await query;

  if (error) {
    return { error: error.message };
  }

  // Filter by search term if provided
  let filteredBookings = bookings || [];
  if (params.search_term) {
    const term = params.search_term.toLowerCase();
    filteredBookings = filteredBookings.filter((b: any) => {
      const userName = b.profiles?.full_name?.toLowerCase() || '';
      const userEmail = b.profiles?.email?.toLowerCase() || '';
      const spaceName = b.spaces?.name?.toLowerCase() || '';
      return userName.includes(term) || userEmail.includes(term) || spaceName.includes(term);
    });
  }

  return {
    count: filteredBookings.length,
    bookings: filteredBookings.map((b: any) => ({
      id: b.id,
      user_name: b.profiles?.full_name || 'Unknown',
      user_email: b.profiles?.email || '',
      space_name: b.spaces?.name || 'Unknown',
      space_type: b.spaces?.type || '',
      location: b.spaces?.location || '',
      date: new Date(b.start_time).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      start_time: new Date(b.start_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      end_time: new Date(b.end_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      amount: `RM ${Number(b.total_amount).toLocaleString()}`,
      status: b.status,
      link: `/admin/bookings?id=${b.id}`
    }))
  };
}

async function getBookingDetails(params: { booking_id: string }) {
  const supabase = await createClient('admin');

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, profiles(full_name, email, phone), spaces(name, type, location, hourly_rate, daily_rate)')
    .eq('id', params.booking_id)
    .single();

  if (error || !booking) {
    return { error: 'Booking not found' };
  }

  // Get payment info if exists
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', params.booking_id)
    .single();

  return {
    id: booking.id,
    user: {
      name: booking.profiles?.full_name || 'Unknown',
      email: booking.profiles?.email || '',
      phone: booking.profiles?.phone || ''
    },
    space: {
      name: booking.spaces?.name || 'Unknown',
      type: booking.spaces?.type || '',
      location: booking.spaces?.location || ''
    },
    date: new Date(booking.start_time).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    start_time: new Date(booking.start_time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    end_time: new Date(booking.end_time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    duration_type: booking.duration_type,
    attendees: booking.attendees_count,
    amount: `RM ${Number(booking.total_amount).toLocaleString()}`,
    status: booking.status,
    notes: booking.notes,
    created_at: new Date(booking.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    payment: payment ? {
      status: payment.payment_status,
      provider: payment.payment_provider,
      paid_at: payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : null
    } : null,
    link: `/admin/bookings?id=${booking.id}`
  };
}

async function getBookingStats(params: { period?: string }) {
  const supabase = await createClient('admin');
  const period = params.period || 'month';

  let dateFilter = new Date();
  if (period === 'today') {
    dateFilter.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    dateFilter.setDate(dateFilter.getDate() - 7);
  } else if (period === 'month') {
    dateFilter.setMonth(dateFilter.getMonth() - 1);
  } else {
    dateFilter = new Date(0); // All time
  }

  // Get counts by status
  const [
    { count: totalBookings },
    { count: pendingCount },
    { count: confirmedCount },
    { count: cancelledCount },
    { data: revenueData },
    { data: recentBookings }
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('created_at', dateFilter.toISOString()),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending').gte('created_at', dateFilter.toISOString()),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').gte('created_at', dateFilter.toISOString()),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled').gte('created_at', dateFilter.toISOString()),
    supabase.from('bookings').select('total_amount').eq('status', 'confirmed').gte('created_at', dateFilter.toISOString()),
    supabase.from('bookings').select('*, profiles(full_name), spaces(name)').order('created_at', { ascending: false }).limit(5)
  ]);

  const totalRevenue = revenueData?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;

  return {
    period,
    total_bookings: totalBookings || 0,
    by_status: {
      pending: pendingCount || 0,
      confirmed: confirmedCount || 0,
      cancelled: cancelledCount || 0
    },
    total_revenue: `RM ${totalRevenue.toLocaleString()}`,
    recent_bookings: recentBookings?.map((b: any) => ({
      id: b.id,
      user: b.profiles?.full_name || 'Unknown',
      space: b.spaces?.name || 'Unknown',
      status: b.status,
      link: `/admin/bookings?id=${b.id}`
    })) || []
  };
}

// Execute function calls
async function executeFunction(name: string, args: any) {
  switch (name) {
    case 'search_bookings':
      return await searchBookings(args);
    case 'get_booking_details':
      return await getBookingDetails(args);
    case 'get_booking_stats':
      return await getBookingStats(args);
    default:
      return { error: 'Unknown function' };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createClient('admin');
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build messages array
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: ADMIN_SYSTEM_PROMPT }
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      recentHistory.forEach((msg: any) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call OpenAI with functions
    let completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: functions,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    });

    let responseMessage = completion.choices[0]?.message;

    // Handle function calls
    while (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      // Execute all function calls
      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        const result = await executeFunction(functionName, functionArgs);

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Add assistant message and tool results to messages
      messages.push(responseMessage);
      messages.push(...toolResults);

      // Get next response
      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: functions,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000,
      });

      responseMessage = completion.choices[0]?.message;
    }

    const finalResponse = responseMessage?.content ||
      'I apologize, but I could not process your request. Please try again.';

    return NextResponse.json({
      message: finalResponse,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Admin Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
