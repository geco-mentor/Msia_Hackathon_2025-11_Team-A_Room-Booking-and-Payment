'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! Welcome to Infinity8. I\'m here to help answer your questions about our coworking spaces, amenities, pricing, and more. How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const playVoice = async (text: string, language: 'english' | 'malay' | 'chinese', messageIndex?: number) => {
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      setIsSpeaking(true);
      if (messageIndex !== undefined) setSpeakingMessageIndex(messageIndex);

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) throw new Error('Failed to generate voice');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      setCurrentAudio(audio);

      audio.onended = () => {
        setIsSpeaking(false);
        setSpeakingMessageIndex(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('Voice playback error:', error);
      setIsSpeaking(false);
    }
  };

  const stopVoice = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processVoiceInput(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    setIsLoading(true);

    try {
      // Convert speech to text
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const sttResponse = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!sttResponse.ok) throw new Error('Failed to transcribe audio');

      const sttData = await sttResponse.json();
      const transcribedText = sttData.text;
      const detectedLanguage = sttData.language || 'english';

      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: transcribedText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Get AI response with detected language hint
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: transcribedText,
          history: [...messages, userMessage],
          detectedLanguage: detectedLanguage
        }),
      });

      if (!chatResponse.ok) throw new Error('Failed to get response');

      const chatData = await chatResponse.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: chatData.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);

      // Play voice after state update - use messages length to get correct index
      const newIndex = messages.length + 1; // +1 for user message already added
      const replyLanguage = (chatData.language as 'english' | 'malay' | 'chinese') || detectedLanguage || 'english';
      await playVoice(chatData.message, replyLanguage, newIndex);

    } catch (error) {
      console.error('Error processing voice input:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your voice message. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    const detectedLanguage = detectLanguage(inputMessage);

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          history: [...messages, userMessage],
          detectedLanguage
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    "What are your pricing plans?",
    "What amenities do you offer?",
    "Where are your locations?",
    "Can I book a tour?"
  ];

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-50 hover:scale-110"
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold">AI</span>
              </div>
              <div>
                <h3 className="font-semibold">Infinity8 Assistant</h3>
                <p className="text-xs opacity-90">Always here to help</p>
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  {/* Show audio wave when AI is speaking this message */}
                  {message.role === 'assistant' && speakingMessageIndex === index ? (
                    <div className="flex items-center space-x-1 py-2">
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-blue-600 rounded-full animate-pulse"
                            style={{
                              height: `${12 + Math.random() * 12}px`,
                              animationDelay: `${i * 0.1}s`,
                              animationDuration: '0.5s'
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500 ml-2">Speaking...</span>
                      <button
                        onClick={stopVoice}
                        className="ml-2 text-red-500 hover:text-red-600 transition"
                        title="Stop"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
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
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length === 1 && (
            <div className="px-4 py-2 bg-white border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setInputMessage(question)}
                    className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-100 transition"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
            <div className="flex space-x-2 items-center">
              {isRecording ? (
                <div className="flex-1 flex items-center justify-center space-x-1 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-1">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-500 rounded-full animate-pulse"
                        style={{
                          height: `${8 + Math.random() * 16}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.3s'
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-red-600 ml-3">Recording...</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  disabled={isLoading}
                />
              )}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`p-2 rounded-lg transition ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isRecording ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim() || isRecording}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
