import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, language } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const englishMalayVoiceId =
      process.env.ELEVENLABS_VOICE_ID_EN ||
      process.env.ELEVENLABS_VOICE_ID_MS ||
      process.env.ELEVENLABS_VOICE_ID_MALAY ||
      process.env.ELEVENLABS_VOICE_ID;
    const chineseVoiceId =
      process.env.ELEVENLABS_VOICE_ID_ZH ||
      process.env.ELEVENLABS_VOICE_ID_CHINESE ||
      process.env.ELEVENLABS_VOICE_ID_CN;

    const resolvedVoiceId =
      language === 'chinese'
        ? (chineseVoiceId || englishMalayVoiceId)
        : (englishMalayVoiceId || chineseVoiceId);

    const voiceId = resolvedVoiceId || '21m00Tcm4TlvDq8ikWAM';

    // Generate speech using ElevenLabs
    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text,
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
      },
    });

    // Convert the audio stream to a buffer
    const reader = audio.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const audioBuffer = Buffer.concat(chunks);

    // Return the audio as a response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Voice API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate voice' },
      { status: 500 }
    );
  }
}
