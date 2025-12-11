import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BOOKING_API_URL || 'http://localhost:8000';

const getSystemPrompt = (detectedLanguage?: string) => {
  let languageInstruction = '';

  if (detectedLanguage === 'malay') {
    languageInstruction = 'The user is speaking in BAHASA MALAYSIA. You MUST reply in Bahasa Malaysia.';
  } else if (detectedLanguage === 'chinese') {
    languageInstruction = 'The user is speaking in CHINESE. You MUST reply in Chinese.';
  } else if (detectedLanguage === 'english') {
    languageInstruction = 'The user is speaking in ENGLISH. You MUST reply in English.';
  }

  return `You are a friendly AI assistant for Infinity8, a coworking space in Malaysia.

Key info:
- Pricing: Day Pass RM50, Monthly RM800, Private Office RM2,500
- Amenities: WiFi, Parking, Gym, Coffee, Kitchen, Phone Booths, Aircon
- Locations: KL, PJ, JB
- Contact: hello@infinity8.my, +60 3-1234-5678

${languageInstruction}

STYLE RULES:
- Keep responses brief (1-3 sentences)
- Be friendly and helpful
- No emojis, no markdown symbols`;
};

const detectLanguage = (text: string): 'english' | 'malay' | 'chinese' => {
  const lowerText = text.toLowerCase();
  const hasChineseChars = /[\u4e00-\u9fff]/.test(text);

  if (hasChineseChars) return 'chinese';

  // Expanded word lists for better detection
  const englishWords = ['what', 'where', 'how', 'when', 'why', 'who', 'the', 'is', 'are', 'can', 'could', 'would', 'should', 'have', 'has', 'do', 'does', 'please', 'thank', 'thanks', 'yes', 'no', 'hello', 'hi', 'room', 'rooms', 'office', 'offices', 'price', 'pricing', 'book', 'booking', 'available', 'want', 'need', 'like', 'about', 'your', 'you', 'this', 'that', 'there', 'here', 'tell', 'me', 'i', 'my', 'we', 'our', 'they', 'it', 'a', 'an', 'of', 'to', 'for', 'in', 'on', 'at', 'with', 'by', 'from', 'meeting', 'space', 'spaces', 'desk', 'hot'];
  const malayWords = ['apa', 'mana', 'bila', 'kenapa', 'siapa', 'bagaimana', 'berapa', 'ada', 'tidak', 'tak', 'boleh', 'saya', 'kami', 'anda', 'awak', 'ini', 'itu', 'ke', 'dari', 'untuk', 'dengan', 'yang', 'dan', 'atau', 'jika', 'kalau', 'bilik', 'pejabat', 'harga', 'tempah', 'ruang', 'kerja', 'tolong', 'terima', 'kasih', 'bukan', 'mahu', 'nak', 'ingin', 'macam', 'mane', 'kat', 'dekat', 'hendak', 'jenis', 'pilihan', 'pilih', 'kita', 'mereka', 'dia', 'bagi', 'lagi', 'sudah', 'dah', 'belum', 'akan', 'masih', 'begitu', 'sahaja', 'saje', 'jer', 'je', 'pun', 'juga', 'tu', 'ni', 'pakej', 'langganan', 'bulanan', 'sewa'];

  let englishScore = 0;
  let malayScore = 0;

  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (englishWords.includes(word)) englishScore++;
    if (malayWords.includes(word)) malayScore++;
  }

  // Prioritize the language with more matches
  if (englishScore > malayScore && englishScore >= 1) return 'english';
  if (malayScore > englishScore && malayScore >= 1) return 'malay';
  if (englishScore >= 1 && malayScore === 0) return 'english';
  if (malayScore >= 1 && englishScore === 0) return 'malay';

  // Default to English if no clear signal
  return 'english';
};

const normalizeLanguage = (language?: string) => {
  const lower = language?.toLowerCase();
  if (lower === 'english' || lower === 'malay' || lower === 'chinese') {
    return lower as 'english' | 'malay' | 'chinese';
  }
  return undefined;
};

const getEscalationMessage = (language: 'english' | 'malay' | 'chinese') => {
  const messages: Record<'english' | 'malay' | 'chinese', string> = {
    english: "I don't have enough information in the knowledge base to answer that accurately. I've sent your request to a human admin who will follow up shortly. For urgent help, email hello@infinity8.my or call +60 3-1234-5678.",
    malay: 'Saya tidak mempunyai maklumat mencukupi dalam pangkalan ilmu untuk menjawab dengan tepat. Permintaan anda telah dihantar kepada admin manusia dan mereka akan menghubungi anda secepat mungkin. Untuk bantuan segera, sila e-mel hello@infinity8.my atau telefon +60 3-1234-5678.',
    chinese: '\\u77e5\\u8b58\\u5eab\\u66ab\\u6642\\u6c92\\u6709\\u8db3\\u5920\\u8cc7\\u8a0a\\u4f86\\u6e96\\u78ba\\u56de\\u7b54\\u9019\\u500b\\u554f\\u984c\\u3002\\u6211\\u5df2\\u8f49\\u4ea4\\u7d66\\u771f\\u4eba\\u7ba1\\u7406\\u54e1\\uff0c\\u5718\\u968a\\u6703\\u76e1\\u5feb\\u56de\\u8986\\u4f60\\u3002\\u5982\\u9700\\u7dca\\u6025\\u5354\\u52a9\\uff0c\\u8acb\\u96fb\\u90f5 hello@infinity8.my \\u6216\\u81f4\\u96fb +60 3-1234-5678\\u3002',
  };

  return messages[language] || messages.english;
};

// Check if the query is related to knowledge base topics
const isKnowledgeBaseQuery = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();

  // Keywords that suggest the user is asking about policies, FAQs, or specific info
  const kbKeywords = [
    'policy', 'policies', 'rule', 'rules', 'guideline', 'guidelines',
    'faq', 'question', 'how do', 'how does', 'what is', 'what are',
    'can i', 'can we', 'allowed', 'permit', 'permitted',
    'membership', 'member', 'benefit', 'benefits', 'perk', 'perks',
    'term', 'terms', 'condition', 'conditions', 'agreement',
    'cancel', 'cancellation', 'refund', 'payment', 'billing',
    'hour', 'hours', 'open', 'opening', 'close', 'closing', 'time',
    'access', 'enter', 'entry', 'key', 'keycard',
    'guest', 'visitor', 'bring', 'invite',
    'wifi', 'internet', 'network', 'password',
    'parking', 'park', 'car',
    'request', 'add-on', 'add on', 'addon', 'custom',
    'food', 'drink', 'eat', 'kitchen', 'pantry',
    'pet', 'pets', 'dog', 'cat', 'animal',
    'noise', 'quiet', 'phone call', 'meeting room',
    'print', 'printer', 'scan', 'scanner', 'copy',
    'locker', 'storage', 'mail', 'address',
    'event', 'events', 'workshop',
    'security', 'safety', 'emergency',
    // Malay keywords
    'polisi', 'peraturan', 'soalan', 'boleh', 'dibenarkan',
    'keahlian', 'ahli', 'syarat', 'pembatalan', 'bayaran',
    'waktu', 'buka', 'tutup', 'akses', 'tetamu', 'pelawat'
  ];

  return kbKeywords.some(keyword => lowerMessage.includes(keyword));
};

// Try to get answer from RAG knowledge base
async function queryKnowledgeBase(
  query: string,
  language: string,
  sessionId?: string,
  userId?: string
): Promise<{ success: boolean; response?: string; escalated?: boolean; confidence?: number }> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/v1/knowledge-base/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        language,
        session_id: sessionId,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      console.error('Knowledge base query failed:', response.status);
      return { success: false };
    }

    const data = await response.json();

    return {
      success: true,
      response: data.response,
      escalated: data.escalated,
      confidence: data.confidence,
    };
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    return { success: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, detectedLanguage, sessionId, userId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Detect language from current message
    const currentMessageLanguage = detectLanguage(message);
    const languageHint = normalizeLanguage(detectedLanguage) || currentMessageLanguage;

    // Check if this might be a knowledge base query
    const shouldTryKnowledgeBase = isKnowledgeBaseQuery(message);

    if (shouldTryKnowledgeBase) {
      // Try to answer from knowledge base first
      const kbResult = await queryKnowledgeBase(message, languageHint, sessionId, userId);

      if (kbResult.success && kbResult.response) {
        // Clean up the response (remove markdown if any)
        let responseMessage = kbResult.response
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/\_\_/g, '')
          .replace(/\_/g, '')
          .replace(/\#\#\#/g, '')
          .replace(/\#\#/g, '')
          .replace(/\#/g, '');

        if (kbResult.escalated) {
          responseMessage = getEscalationMessage(languageHint);
        }

        return NextResponse.json({
          message: responseMessage,
          language: languageHint,
          timestamp: new Date().toISOString(),
          source: 'knowledge_base',
          escalated: !!kbResult.escalated,
          confidence: kbResult.confidence,
        });
      }

      // If the knowledge base cannot answer, hand off to a human admin instead of hallucinating
      const escalationMessage = getEscalationMessage(languageHint);
      return NextResponse.json({
        message: escalationMessage,
        language: languageHint,
        timestamp: new Date().toISOString(),
        source: 'knowledge_base',
        escalated: true,
        confidence: kbResult.confidence ?? 0,
      });
    }

    // Fall back to OpenAI for general queries or if knowledge base didn't work
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: getSystemPrompt(languageHint) }
    ];

    // Add conversation history (limit to last 10 messages to manage token usage)
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

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Call OpenAI API with GPT-4o mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    let responseMessage = completion.choices[0]?.message?.content ||
      'I apologize, but I am unable to process your request at the moment. Please try again or contact us directly at hello@infinity8.my';

    // Remove all markdown formatting symbols
    responseMessage = responseMessage
      .replace(/\*\*/g, '')  // Remove **
      .replace(/\*/g, '')    // Remove *
      .replace(/\_\_/g, '')  // Remove __
      .replace(/\_/g, '')    // Remove _
      .replace(/\#\#\#/g, '') // Remove ###
      .replace(/\#\#/g, '')   // Remove ##
      .replace(/\#/g, '');    // Remove #

    return NextResponse.json({
      message: responseMessage,
      language: languageHint,
      timestamp: new Date().toISOString(),
      source: 'openai',
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
