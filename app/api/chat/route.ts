import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

export async function POST(request: NextRequest) {
  try {
    const { message, history, detectedLanguage } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // IMPORTANT: Always detect language from the CURRENT message, not history
    // This ensures when user switches languages, we respond in the new language
    const currentMessageLanguage = detectLanguage(message);
    
    // Use the passed detectedLanguage (from speech-to-text) if available, 
    // otherwise detect from current message text
    const languageHint = normalizeLanguage(detectedLanguage) || currentMessageLanguage;

    // Prepare messages for OpenAI
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
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
