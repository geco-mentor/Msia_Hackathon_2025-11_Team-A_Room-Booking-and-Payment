import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Convert webm to a format Whisper handles better
    // Try transcription with English first, then without language hint
    let transcription;
    
    try {
      // First attempt: Let Whisper auto-detect with verbose output
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
      });
    } catch (e) {
      // Fallback to simple transcription
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });
    }

    const text = typeof transcription === 'object' && 'text' in transcription 
      ? transcription.text 
      : String(transcription);
    
    // Detect language from the transcribed text
    const whisperLanguage = typeof transcription === 'object' && 'language' in transcription
      ? (transcription as { language?: string }).language
      : undefined;
    const detectedLanguage = decideLanguage(whisperLanguage, text);

    return NextResponse.json({
      text: text,
      language: detectedLanguage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Speech-to-Text API Error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}

function getLanguageSignals(text: string) {
  const lowerText = text.toLowerCase();
  // Expanded English word list with common conversational words
  const englishWords = ['what', 'where', 'how', 'when', 'why', 'who', 'the', 'is', 'are', 'can', 'could', 'would', 'should', 'have', 'has', 'do', 'does', 'please', 'thank', 'thanks', 'yes', 'no', 'hello', 'hi', 'room', 'rooms', 'office', 'offices', 'price', 'pricing', 'book', 'booking', 'available', 'want', 'need', 'like', 'about', 'your', 'you', 'this', 'that', 'there', 'here', 'tell', 'me', 'i', 'my', 'we', 'our', 'they', 'it', 'a', 'an', 'of', 'to', 'for', 'in', 'on', 'at', 'with', 'by', 'from', 'up', 'out', 'if', 'or', 'and', 'but', 'so', 'as', 'any', 'all', 'each', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'now', 'know', 'get', 'go', 'come', 'make', 'see', 'look', 'find', 'give', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call', 'meeting', 'space', 'spaces', 'desk', 'hot'];
  // Malay words - distinct words that don't appear in English
  const malayWords = ['apa', 'mana', 'bila', 'kenapa', 'siapa', 'bagaimana', 'berapa', 'ada', 'tidak', 'tak', 'boleh', 'saya', 'kami', 'anda', 'awak', 'ini', 'itu', 'ke', 'dari', 'untuk', 'dengan', 'yang', 'dan', 'atau', 'jika', 'kalau', 'bilik', 'pejabat', 'harga', 'tempah', 'ruang', 'kerja', 'tolong', 'terima', 'kasih', 'bukan', 'mahu', 'nak', 'ingin', 'sini', 'sana', 'terdapat', 'tersedia', 'macam', 'mane', 'kat', 'dekat', 'hendak', 'jenis', 'pilihan', 'pilih', 'kita', 'mereka', 'dia', 'kami', 'bagi', 'lagi', 'sudah', 'dah', 'belum', 'akan', 'masih', 'situ', 'begitu', 'begini', 'sahaja', 'saje', 'jer', 'je', 'pun', 'juga', 'lah', 'kah', 'kan', 'tu', 'ni', 'pakej', 'langganan', 'bulanan', 'sewa'];
  const hasChineseChars = /[\u4e00-\u9fff]/.test(text);

  let englishScore = 0;
  let malayScore = 0;

  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (englishWords.includes(word)) englishScore++;
    if (malayWords.includes(word)) malayScore++;
  }

  return { englishScore, malayScore, hasChineseChars };
}

function decideLanguage(whisperLanguage?: string, text?: string): 'english' | 'malay' | 'chinese' {
  const whisper = mapWhisperLanguage(whisperLanguage);
  if (!text || text.trim().length === 0) return whisper || 'english';

  const { englishScore, malayScore, hasChineseChars } = getLanguageSignals(text);
  
  // Chinese has clear character markers
  if (hasChineseChars) return 'chinese';

  // If Whisper provided a language, trust it unless text strongly disagrees
  if (whisper === 'english') {
    if (malayScore >= englishScore + 2 && malayScore >= 2) return 'malay';
    return 'english';
  }
  if (whisper === 'malay') {
    if (englishScore >= malayScore + 2 && englishScore >= 3) return 'english';
    return 'malay';
  }
  if (whisper === 'chinese') return 'chinese';

  // No Whisper hint: fall back to text signals
  if (malayScore >= 2 && malayScore >= englishScore) return 'malay';
  if (englishScore >= 1 && englishScore >= malayScore) return 'english';

  return 'english';
}

function mapWhisperLanguage(language?: string): 'english' | 'malay' | 'chinese' | undefined {
  if (!language) return undefined;
  const lower = language.toLowerCase();
  if (lower.startsWith('en')) return 'english';
  if (lower === 'ms' || lower === 'msa' || lower.startsWith('ms-')) return 'malay';
  if (lower === 'zh' || lower.startsWith('zh-') || lower === 'zho') return 'chinese';
  return undefined;
}
