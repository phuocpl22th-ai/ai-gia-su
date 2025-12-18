
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import * as geminiService from '../services/geminiService';
import ChatMessageComponent from './ChatMessage';

interface ChatbotProps {
    onClose: () => void;
    initialMessages: ChatMessage[];
    onMessagesUpdate: (messages: ChatMessage[]) => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ onClose, initialMessages, onMessagesUpdate }) => {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const isStreaming = useRef(false);

    useEffect(() => {
        // PREVENT DATA LOSS: Only sync from props if we aren't currently streaming.
        if (isStreaming.current) return;

        // Sync state if a different user's history is passed in (e.g., on login).
        setMessages(initialMessages);
    }, [initialMessages]);

    useEffect(() => {
        const container = chatContainerRef.current;
        if (container) {
            // Calculate if user is near the bottom (within 150px)
            const isScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
            
            // Only scroll to bottom if the user is already there.
            // We REMOVED the check for `!isStreaming.current` here. 
            // This prevents the chat from forcing you down when you are reading history.
            if (isScrolledToBottom) {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages]);
    
    // This useEffect handles saving the conversation history.
    useEffect(() => {
        if (!isStreaming.current && messages !== initialMessages) {
            onMessagesUpdate(messages);
        }
    }, [messages, initialMessages, onMessagesUpdate]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input };
        const currentMessages = [...messages, userMessage];
        
        setMessages(currentMessages);
        setInput('');
        
        // Force scroll to bottom immediately when user sends a message
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        setIsLoading(true);
        isStreaming.current = true;

        try {
            // Add a placeholder for the streaming response
            setMessages(prev => [...prev, { role: 'model', content: '' }]);

            const stream = await geminiService.getChatbotResponseStream(currentMessages, input);
            let accumulatedResponse = "";
            for await (const chunk of stream) {
                accumulatedResponse += chunk;
                setMessages(prev => {
                    const newMessages = [...prev];
                    if (newMessages.length > 0) {
                        newMessages[newMessages.length - 1].content = accumulatedResponse;
                    }
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Chatbot failed to get response:", error);
            setMessages(prev => {
                 const newMessages = [...prev];
                 if (newMessages.length > 0) {
                    newMessages[newMessages.length - 1].content = "Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại.";
                 }
                 return newMessages;
            });
        } finally {
            isStreaming.current = false;
            setIsLoading(false);
        }
    }, [input, isLoading, messages]);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-lg h-[80vh] grid grid-rows-[auto_1fr_auto] bg-white dark:bg-slate-800 rounded-xl shadow-2xl m-4"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">AI Chatbot</h1>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <main ref={chatContainerRef} className="p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <ChatMessageComponent 
                            key={index} 
                            message={msg}
                            isLoading={isLoading && index === messages.length -1}
                        />
                    ))}
                    <div ref={chatEndRef} />
                </main>

                <footer className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
                        className="flex items-center gap-3"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Hỏi tôi bất cứ điều gì..."
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-full bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-indigo-600 text-white font-bold p-3 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed transition"
                            aria-label="Gửi tin nhắn"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
};

export default Chatbot;
