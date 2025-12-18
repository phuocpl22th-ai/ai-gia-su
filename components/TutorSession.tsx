
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, ChatMessage, GeneratedQuiz, PrebuiltVoice } from '../types';
import * as geminiService from '../services/geminiService';
import { SUPPORTED_VOICES } from '../services/geminiService';
import ChatMessageComponent from './ChatMessage';
import QuizView from './QuizView';

// TypeScript interfaces for the Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}
interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}
interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
    length: number;
}
interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
interface SpeechRecognitionStatic {
    new(): SpeechRecognition;
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: Event & { error: string }) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}
declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionStatic;
        webkitSpeechRecognition: SpeechRecognitionStatic;
    }
}


// Utility to convert file to base64
const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = error => reject(error);
  });
};

// Audio decoding utilities as per guidelines
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

type Conversation = ChatMessage[];
type Session = {
  profile: UserProfile;
  conversations: Conversation[];
  currentConversationIndex: number;
};

interface TutorSessionProps {
  session: Session;
  onLogout: () => void;
  onSessionUpdate: (session: Session) => void;
  onSwitchSubject: () => void;
  onNewConversation: (subjectName: string) => void;
}

const TutorSession: React.FC<TutorSessionProps> = ({ session, onLogout, onSessionUpdate, onSwitchSubject, onNewConversation }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(session.conversations[session.currentConversationIndex]);
  const [profile, setProfile] = useState<UserProfile>(session.profile);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<GeneratedQuiz | null>(null);
  const [image, setImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Smart Tools State
  const [isSmartToolsOpen, setIsSmartToolsOpen] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null); // Use ref for direct access to the audio source

  // State now only tracks UI-related info, not the source object itself
  const [audioState, setAudioState] = useState<{ isLoading: boolean; playingIndex: number | null; }>({ isLoading: false, playingIndex: null });
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastInputWasVoice = useRef(false);
  const [isTextToSpeechEnabled, setIsTextToSpeechEnabled] = useState(true);


  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null); // Ref for textarea focus
  const isStreaming = useRef(false);

  useEffect(() => {
    // CRITICAL FIX: Do not overwrite local messages from props if we are currently streaming.
    // This prevents the user's new question from disappearing if the parent component re-renders
    // with stale data before the stream finishes.
    if (isStreaming.current) return;

    // This effect syncs the component's state with the session prop.
    // It's crucial for updating the view when a new conversation is started.
    setMessages(session.conversations[session.currentConversationIndex] || []);
    setProfile(session.profile);
  }, [session]);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    return () => {
        // Cleanup on unmount
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        audioContextRef.current?.close();
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
    }
    setAudioState({ isLoading: false, playingIndex: null });
  }, []); // This function is stable

  useEffect(() => {
    // If the master text-to-speech toggle is turned off, stop audio immediately.
    if (!isTextToSpeechEnabled) {
      stopAudio();
    }
  }, [isTextToSpeechEnabled, stopAudio]);

  const handlePlayAudio = useCallback(async (text: string, messageIndex: number) => {
    const audioContext = audioContextRef.current;
    if (!audioContext) {
        alert("AudioContext is not available.");
        return;
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    const wasPlayingThisMessage = audioState.playingIndex === messageIndex;

    // Always stop any current audio. This handles both pausing and switching tracks.
    stopAudio();

    // If the user simply wanted to stop the currently playing message, we're done.
    if (wasPlayingThisMessage) {
        return;
    }

    setAudioState({ isLoading: true, playingIndex: messageIndex });
    try {
        const base64Audio = await geminiService.generateSpeech(text, profile.voice);
        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, audioContext, 24000, 1);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        audioSourceRef.current = source; // Store the new source in the ref

        source.onended = () => {
            // Ensure we only clear state if this specific audio source finished
            // and wasn't stopped manually by another action.
            if (audioSourceRef.current === source) {
                audioSourceRef.current = null;
                setAudioState({ isLoading: false, playingIndex: null });
            }
        };
        source.start();
        setAudioState({ isLoading: false, playingIndex: messageIndex });
    } catch (error) {
        console.error("Failed to generate or play speech:", error);
        setAudioState({ isLoading: false, playingIndex: null });
        audioSourceRef.current = null; // Clear ref on error
        alert("Không thể phát âm thanh vào lúc này.");
    }
  }, [audioState.playingIndex, stopAudio, profile.voice]);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if ((!messageText.trim() && !image) || isLoading) return;

    setIsLoading(true);
    isStreaming.current = true;
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageText,
      ...(image && { userImage: { base64: image.base64, mimeType: image.mimeType } }),
    };
    
    const conversationHistory = [...messages, userMessage];
    setMessages(conversationHistory);

    // Force scroll to bottom when user sends a message
    setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    setUserInput('');
    setImage(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }

    try {
      if (messageText.trim().toLowerCase() === '/quiz') {
        const quiz = await geminiService.generateQuiz(conversationHistory.slice(0, -1), profile);
        setMessages(prev => [...prev, { role: 'model', content: "Tuyệt vời! Dưới đây là một bài kiểm tra nhanh dành cho bạn:" }]);
        setCurrentQuiz(quiz);
      } else if (messageText.trim().toLowerCase().startsWith('/image')) {
        const prompt = messageText.replace('/image', '').trim();
        if (prompt) {
          const imageUrl = await geminiService.generateImage(prompt);
          setMessages(prev => [...prev, { role: 'model', content: `Đây là hình ảnh cho: "${prompt}"`, modelImageUrl: `data:image/png;base64,${imageUrl}` }]);
        } else {
           setMessages(prev => [...prev, { role: 'model', content: "Vui lòng cung cấp mô tả cho hình ảnh bạn muốn tạo. Ví dụ: `/image một tế bào thực vật`" }]);
        }
      } else {
        // Add a placeholder for the streaming response
        setMessages(prev => [...prev, { role: 'model', content: '' }]);

        const stream = await geminiService.continueConversationStream(conversationHistory, messageText, profile, image ? { base64: image.base64, mimeType: image.mimeType } : undefined);
        
        let accumulatedResponse = "";
        for await (const chunk of stream) {
          accumulatedResponse += chunk;
          setMessages(prev => {
              const newMessages = [...prev];
              // Update the content of the last message (the placeholder)
              newMessages[newMessages.length - 1].content = accumulatedResponse;
              return newMessages;
          });
        }
        
        // After stream, parse for suggested questions
        const separator = "[SUGGESTED_QUESTIONS]";
        if (accumulatedResponse.includes(separator)) {
            const parts = accumulatedResponse.split(separator);
            const mainContent = parts[0].trim();
            const questionsText = parts[1].trim();
            const questions = questionsText.split('\n')
                .map(q => q.trim().replace(/^- /, ''))
                .filter(q => q);

            setMessages(prev => {
                const newMessages = [...prev];
                const msgToUpdate = newMessages[newMessages.length - 1];
                msgToUpdate.content = mainContent;
                msgToUpdate.suggestedQuestions = questions;
                return newMessages;
            });
        }

      }
    } catch (error) {
      console.error("Failed to get response from Gemini:", error);
      setMessages(prev => [...prev, { role: 'model', content: "Rất tiếc, tôi đang gặp sự cố. Vui lòng thử lại sau." }]);
    } finally {
      isStreaming.current = false;
      setIsLoading(false);
    }
  }, [image, isLoading, messages, profile]);

  const handleSmartEdit = async (action: geminiService.EditAction) => {
    setIsSmartToolsOpen(false);
    setIsRefining(true);
    try {
        const refinedText = await geminiService.refineText(userInput, action);
        setUserInput(refinedText);
    } catch (error) {
        console.error("Failed to refine text:", error);
    } finally {
        setIsRefining(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
        alert("Vui lòng chỉ chọn file hình ảnh.");
        return;
    }
    if (image?.preview) {
        URL.revokeObjectURL(image.preview);
    }
    try {
        const { base64, mimeType } = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        setImage({ base64, mimeType, preview });
    } catch (error) {
        console.error("Error converting file to base64:", error);
        alert("Không thể xử lý hình ảnh. Vui lòng thử lại.");
    }
  }, [image]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        await processFile(file);
    }
  };

  // Drag and Drop Handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
        setIsDragging(true);
    }
  }, [isDragging]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        await processFile(file);
    }
  }, [processFile]);

  // --- SHORTCUTS & PASTE HANDLER ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Esc to cancel image or close tools
        if (e.key === 'Escape') {
            if (image) {
                setImage(null);
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
            if (isSmartToolsOpen) setIsSmartToolsOpen(false);
        }
        // Ctrl+/ or Cmd+/ to focus input
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            textInputRef.current?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent) => {
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                // If pasted content is an image
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault(); // Stop image from being pasted as text filename
                        processFile(file);
                    }
                    break; // Only take the first image
                }
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('paste', handlePaste);

    return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown);
        window.removeEventListener('paste', handlePaste);
    };
  }, [image, isSmartToolsOpen, processFile]);


  // --- SEPARATE SCROLL EFFECT ---
  // This effect purely handles auto-scrolling when new messages arrive.
  // It checks if the user is already at the bottom before scrolling to prevent
  // annoying jumps when reading history.
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
         // Tolerance of 150px
         const isScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
         
         // Only auto-scroll if the user is ALREADY at the bottom.
         // This ensures we don't yank the user down if they are scrolled up reading history.
         if (isScrolledToBottom) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
         }
    }
  }, [messages]);

  // --- SESSION UPDATE & AUDIO AUTO-PLAY EFFECT ---
  useEffect(() => {
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];

        // When streaming is done, update the session in the parent component.
        if (!isStreaming.current && !currentQuiz) {
            const updatedConversations = [...session.conversations];
            updatedConversations[session.currentConversationIndex] = messages;
            
            onSessionUpdate({ 
                ...session,
                conversations: updatedConversations 
            });
        }
        
        // Auto-play audio for voice input responses, but only when streaming is complete
        if (!isStreaming.current && isTextToSpeechEnabled && lastInputWasVoice.current && lastMessage.role === 'model' && !isLoading && lastMessage.content) {
            handlePlayAudio(lastMessage.content, messages.length - 1);
            lastInputWasVoice.current = false; // Reset flag
        }
    }
  }, [messages, session, currentQuiz, isLoading, isTextToSpeechEnabled, onSessionUpdate, handlePlayAudio]);


  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'vi-VN';

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        lastInputWasVoice.current = true;
        handleSendMessage(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      finalTranscript = ''; // Reset to rebuild full sentence
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setUserInput(finalTranscript + interimTranscript);
    };

    recognitionRef.current = recognition;
  }, [handleSendMessage]);

  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setUserInput('');
      recognitionRef.current.start();
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lastInputWasVoice.current = false; // Ensure this is false for typed messages
    handleSendMessage(userInput);
  };
  
  const handleQuizComplete = (score: number, total: number) => {
    setCurrentQuiz(null);
    const resultMessage = `Bạn đã hoàn thành bài kiểm tra với số điểm ${score}/${total}! Hãy tiếp tục phát huy nhé.`;
    setMessages(prev => [...prev, { role: 'model', content: resultMessage }]);
  };
  
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVoice = e.target.value as PrebuiltVoice;
    const newProfile = { ...profile, voice: newVoice };
    setProfile(newProfile);
    // Construct the full session object to update
    const updatedConversations = [...session.conversations];
    updatedConversations[session.currentConversationIndex] = messages;
    onSessionUpdate({ ...session, profile: newProfile, conversations: updatedConversations });
  };

  return (
    <div 
        className="w-full max-w-3xl mx-auto h-[90vh] grid grid-rows-[auto_1fr_auto] bg-white dark:bg-slate-800 rounded-xl shadow-2xl animate-fade-in relative overflow-hidden"
        onDragEnter={handleDragEnter}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
          <div 
            className="absolute inset-0 z-50 bg-indigo-600/10 dark:bg-indigo-400/10 backdrop-blur-sm border-2 border-dashed border-indigo-500 rounded-xl flex items-center justify-center pointer-events-auto"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl flex flex-col items-center animate-bounce">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-indigo-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Thả ảnh vào đây</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">để gửi cho gia sư AI</p>
              </div>
          </div>
      )}

      <header className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-4 z-10">
        <div>
           <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{profile.subject}</h1>
           <p className="text-sm text-slate-500 dark:text-slate-400">Trợ lý học tập của {profile.username}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
                <select
                  id="voice-selector"
                  value={profile.voice}
                  onChange={handleVoiceChange}
                  className="appearance-none w-full text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 pl-3 pr-8 rounded-md leading-tight focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500"
                  aria-label="Chọn giọng nói"
                >
                    {SUPPORTED_VOICES.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-300">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
            <button
              onClick={() => setIsTextToSpeechEnabled(!isTextToSpeechEnabled)}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800"
              aria-label={isTextToSpeechEnabled ? "Tắt tính năng đọc" : "Bật tính năng đọc"}
              title={isTextToSpeechEnabled ? "Tắt tính năng đọc" : "Bật tính năng đọc"}
            >
              {isTextToSpeechEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.083A7.474 7.474 0 005.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v.083m0 13.834V19c0 .891-1.077 1.337-1.707.707L5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l.293-.293m12.121.293l-1.414 1.414M19.5 19.5l-1.414 1.414M3 3l18 18" />
                </svg>
              )}
            </button>
            <button
              onClick={() => onNewConversation(profile.subject)}
              className="bg-green-500 text-white text-sm font-bold py-2 px-3 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-slate-800"
              title="Bắt đầu một cuộc trò chuyện mới"
            >
              Trò chuyện mới
            </button>
             <button
              onClick={onSwitchSubject}
              className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold py-2 px-3 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800"
            >
              Môn khác
            </button>
            <button
              onClick={onLogout}
              className="bg-red-500 text-white text-sm font-bold py-2 px-3 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-slate-800"
            >
              Đăng xuất
            </button>
        </div>
      </header>

      <main ref={chatContainerRef} className="p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <ChatMessageComponent 
              key={index}
              message={msg}
              messageIndex={index}
              audioState={audioState}
              onPlayAudio={handlePlayAudio}
              isTextToSpeechEnabled={isTextToSpeechEnabled}
              isLoading={isLoading && index === messages.length - 1 && msg.role === 'model'}
              onSendMessage={handleSendMessage}
            />
        ))}
        {currentQuiz && <QuizView quizData={currentQuiz} onQuizComplete={handleQuizComplete} />}
        <div ref={chatEndRef} />
      </main>

      <footer className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 z-10">
        <form onSubmit={handleSubmit} className="flex items-start gap-3 relative">
          
          {/* Magic Tools Menu */}
          {isSmartToolsOpen && (
              <div className="absolute bottom-full mb-3 left-0 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-600 p-2 z-10 w-64 animate-fade-in">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2 uppercase">Hỗ trợ thông minh</p>
                  <button 
                    type="button" 
                    onClick={() => handleSmartEdit('fix_grammar')}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <span>✏️</span> Sửa chính tả & Ngữ pháp
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleSmartEdit('improve_writing')}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <span>✨</span> Viết lại hay hơn
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleSmartEdit('translate_en')}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <span>🌐</span> Dịch sang Tiếng Anh
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleSmartEdit('suggest_question')}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <span>💡</span> Gợi ý câu hỏi
                  </button>
              </div>
          )}
          
          {/* Smart Tools Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSmartToolsOpen(!isSmartToolsOpen)}
            className={`p-3 rounded-full transition-colors ${
                isSmartToolsOpen 
                ? 'bg-indigo-100 text-indigo-600 dark:bg-slate-700 dark:text-indigo-400' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            aria-label="Công cụ thông minh"
            title="Công cụ hỗ trợ viết thông minh"
            disabled={isLoading || isRefining}
          >
            {isRefining ? (
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Đính kèm hình ảnh"
            disabled={!!currentQuiz || isLoading || isListening}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
            accept="image/*"
          />
          <div className="relative flex-1">
            {image && (
              <div className="absolute bottom-full left-0 mb-2 p-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg">
                <img src={image.preview} alt="Xem trước" className="h-20 w-20 object-cover rounded" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold"
                >
                  X
                </button>
              </div>
            )}
            <textarea
              ref={textInputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={isListening ? "Đang lắng nghe..." : (isRefining ? "Đang xử lý..." : "Nhập tin nhắn hoặc dùng lệnh /quiz, /image...")}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
              rows={1}
              disabled={isLoading || !!currentQuiz || isRefining}
            />
          </div>
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isLoading || !!currentQuiz}
            className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors relative ${
                isListening 
                ? 'bg-red-500 text-white focus:ring-red-500' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 focus:ring-indigo-500'
            }`}
            aria-label={isListening ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
          >
            {isListening && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
          <button
            type="submit"
            disabled={isLoading || (!userInput.trim() && !image) || !!currentQuiz}
            className="bg-indigo-600 text-white font-bold p-3 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed transition"
            aria-label="Gửi tin nhắn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default TutorSession;
