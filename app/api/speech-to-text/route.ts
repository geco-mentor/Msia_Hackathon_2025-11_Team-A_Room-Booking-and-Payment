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
  const englishWords = ['what', 'where', 'how', 'when', 'why', 'who', 'the', 'is', 'are', 'can', 'could', 'would', 'should', 'have', 'has', 'do', 'does', 'please', 'thank', 'thanks', 'yes', 'no', 'hello', 'hi', 'room', 'office', 'price', 'pricing', 'book', 'available', 'want', 'need', 'like', 'about', 'your', 'you', 'this', 'that', 'there', 'here'];
  const malayWords = ['apa', 'mana', 'bila', 'kenapa', 'siapa', 'bagaimana', 'berapa', 'ada', 'tidak', 'tak', 'boleh', 'saya', 'kami', 'anda', 'awak', 'ini', 'itu', 'di', 'ke', 'dari', 'untuk', 'dengan', 'yang', 'dan', 'atau', 'jika', 'kalau', 'bilik', 'pejabat', 'harga', 'tempah', 'ruang', 'kerja', 'tolong', 'terima', 'kasih', 'ya', 'bukan', 'mahu', 'nak', 'ingin', 'sini', 'sana', 'terdapat', 'tersedia'];
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
  if (hasChineseChars) return 'chinese';

  // If Whisper is confident, trust it unless the text strongly disagrees.
  if (whisper === 'english' && malayScore < 2) return 'english';
  if (whisper === 'malay' && englishScore < 2) return 'malay';
  if (whisper === 'chinese') return 'chinese';

  // Heuristic tie-breakers.
  if (englishScore >= malayScore + 1 && englishScore >= 2) return 'english';
  if (malayScore >= englishScore + 1 && malayScore >= 1) return 'malay';

  // Fallback to Whisper hint or default English.
  return whisper || 'english';
}

function mapWhisperLanguage(language?: string): 'english' | 'malay' | 'chinese' | undefined {
  if (!language) return undefined;
  const lower = language.toLowerCase();
  if (lower.startsWith('en')) return 'english';
  if (lower === 'ms' || lower === 'msa' || lower.startsWith('ms-')) return 'malay';
  if (lower === 'zh' || lower.startsWith('zh-') || lower === 'zho') return 'chinese';
  return undefined;
}
