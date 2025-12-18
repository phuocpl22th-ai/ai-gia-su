
import React from 'react';
import { ChatMessage } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ChatMessageProps {
  message: ChatMessage;
  isLoading?: boolean;
  messageIndex?: number;
  audioState?: { isLoading: boolean; playingIndex: number | null; };
  onPlayAudio?: (text: string, messageIndex: number) => void;
  isTextToSpeechEnabled?: boolean;
  onSendMessage?: (message: string) => void;
}

// A more capable markdown parser for Tailwind CSS Prose
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  if (!text.trim()) {
    return null;
  }
  // Process the text block by block. Blocks are separated by one or more empty lines.
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim() !== '');

  const renderInline = (line: string) => {
    // Process **bold** text
    const parts = line.split(/(\*\*.*?\*\*)/g).filter(part => part);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Process *italic* text (simple implementation)
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        
        // Headings
        if (trimmed.startsWith('### ')) return <h3 key={i}>{renderInline(trimmed.substring(4))}</h3>;
        if (trimmed.startsWith('## ')) return <h2 key={i}>{renderInline(trimmed.substring(3))}</h2>;
        if (trimmed.startsWith('# ')) return <h1 key={i}>{renderInline(trimmed.substring(2))}</h1>;

        // Check for unordered lists
        const isUnorderedList = trimmed.startsWith('* ') || trimmed.startsWith('- ');
        if (isUnorderedList) {
          const listItems = block.split('\n').filter(item => item.trim().startsWith('* ') || item.trim().startsWith('- '));
          return (
            <ul key={i}>
              {listItems.map((item, j) => (
                <li key={j}>{renderInline(item.trim().substring(2))}</li>
              ))}
            </ul>
          );
        }
        
        // Treat as a paragraph
        return (
          <p key={i}>
            {
              // Handle soft line breaks within a paragraph
              block.split('\n').map((line, j) => (
                <React.Fragment key={j}>
                  {renderInline(line)}
                  {j < block.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))
            }
          </p>
        );
      })}
    </>
  );
};


const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, isLoading, messageIndex, audioState, onPlayAudio, isTextToSpeechEnabled, onSendMessage }) => {
  const isModel = message.role === 'model';
  const userImageSrc = message.userImage ? `data:${message.userImage.mimeType};base64,${message.userImage.base64}` : null;

  const canPlayAudio = isTextToSpeechEnabled && isModel && message.content && messageIndex !== undefined && audioState && onPlayAudio;
  const isThisMessageLoadingAudio = canPlayAudio && audioState.isLoading && audioState.playingIndex === messageIndex;
  const isThisMessagePlaying = canPlayAudio && !audioState.isLoading && audioState.playingIndex === messageIndex;


  if (isModel && message.content === '' && !message.modelImageUrl && isLoading) {
    return (
      <div className="flex items-end gap-2 justify-start">
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
          AI
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="w-full">
        <div className={`flex items-end gap-2 ${!isModel ? 'justify-end' : 'justify-start'}`}>
          {isModel && (
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0 self-start mt-1">
              AI
            </div>
          )}
          <div
            className={`max-w-xl px-4 py-3 rounded-2xl shadow-md flex flex-col gap-2 ${
              isModel
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                : 'bg-indigo-600 text-white rounded-br-none'
            }`}
          >
            {message.modelImageUrl && (
                <img 
                    src={message.modelImageUrl} 
                    alt="Hình ảnh do AI tạo ra" 
                    className="rounded-lg max-w-full h-auto border border-slate-200 dark:border-slate-600" 
                />
            )}
            {userImageSrc && (
                 <img 
                    src={userImageSrc} 
                    alt="Hình ảnh do người dùng tải lên" 
                    className="rounded-lg max-w-full h-auto border border-slate-200 dark:border-slate-600" 
                />
            )}
            {message.content && (
                // Removed 'prose-sm' to increase font size.
                // Added specific prose-headings, prose-p, prose-li classes via 'prose' plugin to control appearance.
                <div className="prose prose-slate dark:prose-invert max-w-none break-words leading-relaxed">
                    <SimpleMarkdown text={message.content} />
                </div>
            )}
             {/* Add a blinking cursor effect for streaming messages */}
             {isLoading && isModel && <span className="inline-block w-2 h-4 bg-slate-700 dark:bg-slate-300 animate-pulse ml-1"></span>}
          </div>

          {canPlayAudio && !isLoading && (
            <button
              onClick={() => onPlayAudio(message.content, messageIndex)}
              disabled={isThisMessageLoadingAudio}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait transition-colors self-start mt-1"
              aria-label={isThisMessagePlaying ? "Dừng đọc" : "Đọc to"}
            >
              {isThisMessageLoadingAudio ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-indigo-500 rounded-full animate-spin"></div>
              ) : isThisMessagePlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 9h4v12H4zM10 9h4v12h-4zM16 9h4v12h-4z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
          )}
        </div>

        {isModel && message.suggestedQuestions && message.suggestedQuestions.length > 0 && !isLoading && (
            <div className="pl-10 mt-3 flex flex-wrap gap-2" aria-label="Câu hỏi gợi ý">
                {message.suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => onSendMessage && onSendMessage(question)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {question}
                  </button>
                ))}
            </div>
        )}
    </div>
  );
};

export default ChatMessageComponent;
