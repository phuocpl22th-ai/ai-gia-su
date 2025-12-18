
import React, { useState, useEffect, useCallback } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import SubjectSelectionScreen from './components/SubjectSelectionScreen';
import TutorSession from './components/TutorSession';
import LoadingSpinner from './components/LoadingSpinner';
import LoginScreen from './components/LoginScreen';
import Chatbot from './components/Chatbot'; // Import the new Chatbot component
import { UserProfile, AppState, ChatMessage } from './types';
import * as geminiService from './services/geminiService';
import * as authService from './services/authService';
import { SUPPORTED_VOICES } from './services/geminiService';

type Conversation = ChatMessage[];
type Session = {
  profile: UserProfile;
  conversations: Conversation[];
  currentConversationIndex: number;
};
type AllSessions = Record<string, Session>;


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(authService.getCurrentUser());
  const [appState, setAppState] = useState<AppState>('WELCOME');
  const [allSessions, setAllSessions] = useState<AllSessions>({});
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false); // State for the new chatbot
  const [chatbotMessages, setChatbotMessages] = useState<ChatMessage[]>([]); // State for chatbot history

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    
    // Load all saved sessions for the current user from localStorage on startup.
    try {
      const sessionsKey = `tutorSessions_${currentUser}`;
      const savedSessionsRaw = localStorage.getItem(sessionsKey);
      if (savedSessionsRaw) {
        const sessions: AllSessions = JSON.parse(savedSessionsRaw);
        
        // Data migration/validation for old formats
        Object.values(sessions).forEach((s: any) => {
            const session = s as Session & { messages?: ChatMessage[] };

            // Migrate from old `messages` array to new `conversations` structure
            if (session.messages) {
                session.conversations = [session.messages];
                delete session.messages;
                session.currentConversationIndex = 0;
            }
            
            // Ensure conversations array exists and is not empty
            if (!session.conversations || session.conversations.length === 0) {
                session.conversations = [[{ role: 'model', content: `Chào mừng bạn quay trở lại với môn ${session.profile.subject}! Chúng ta tiếp tục từ đâu đây?` }]];
                session.currentConversationIndex = 0;
            }

            // Voice data migration
            if (session.profile && !session.profile.voice) {
                session.profile.voice = SUPPORTED_VOICES[0].id;
            }
        });

        setAllSessions(sessions);
        setAppState(Object.keys(sessions).length > 0 ? 'SUBJECT_SELECTION' : 'WELCOME');
      } else {
        setAllSessions({});
        setAppState('WELCOME');
      }
      
      // Load chatbot history for the current user.
      const chatbotKey = `chatbotHistory_${currentUser}`;
      const savedChatbotHistoryRaw = localStorage.getItem(chatbotKey);
      if (savedChatbotHistoryRaw) {
          try {
              setChatbotMessages(JSON.parse(savedChatbotHistoryRaw));
          } catch {
              // If parsing fails, start with a fresh chat.
              setChatbotMessages([{ role: 'model', content: 'Xin chào! Tôi là trợ lý AI. Tôi có thể giúp gì cho bạn hôm nay?' }]);
          }
      } else {
          // If no history, provide the initial welcome message.
          setChatbotMessages([{ role: 'model', content: 'Xin chào! Tôi là trợ lý AI. Tôi có thể giúp gì cho bạn hôm nay?' }]);
      }

    } catch (error) {
      console.error("Failed to load sessions from localStorage", error);
      const sessionKey = `tutorSessionHistory_${currentUser}`;
      const sessionsKey = `tutorSessions_${currentUser}`;
      localStorage.removeItem(sessionKey); // Clear old key format
      localStorage.removeItem(sessionsKey); // Clear potentially corrupted new key format
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);


  const handleWelcomeSubmit = async (data: Omit<UserProfile, 'username'>) => {
    if (!currentUser) return;

    if (allSessions[data.subject]) {
        alert("Môn học này đã tồn tại. Vui lòng chọn từ danh sách hoặc tạo một môn học với tên khác.");
        handleSelectSubject(data.subject);
        return;
    }

    setIsLoading(true);
    const profile: UserProfile = { ...data, username: currentUser };

    try {
        const initialMessageContent = await geminiService.generateInitialMessage(profile);
        const initialMessage: ChatMessage = { role: 'model', content: initialMessageContent };
        
        const newSession: Session = { 
            profile, 
            conversations: [[initialMessage]], 
            currentConversationIndex: 0 
        };
        
        const updatedSessions = { ...allSessions, [profile.subject]: newSession };
        setAllSessions(updatedSessions);
        setCurrentSession(newSession);

        localStorage.setItem(`tutorSessions_${currentUser}`, JSON.stringify(updatedSessions));
        
        setAppState('TUTOR_SESSION');
    } catch (error) {
        console.error("Failed to start new session:", error);
        alert("Không thể bắt đầu buổi học mới. Vui lòng thử lại.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = async (username: string, password: string) => {
    const result = authService.login(username, password);
    if (result.success) {
      setCurrentUser(username);
    }
    return result;
  };

  const handleRegister = async (username: string, password: string) => {
    return authService.register(username, password);
  };
  
  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setAllSessions({});
    setCurrentSession(null);
    setChatbotMessages([]); // Clear chatbot history on logout
    setAppState('WELCOME'); // Reset state
  };

  const handleSwitchSubject = () => {
    setCurrentSession(null);
    setAppState('SUBJECT_SELECTION');
  };
  
  const handleRecoverPassword = async (username: string) => {
    return authService.recoverPassword(username);
  };
  
  const handleSessionUpdate = useCallback((updatedSession: Session) => {
      if (!currentUser || !updatedSession) return;
      
      // Use functional updates for state setters to prevent race conditions
      // where updates might be based on stale state.
      setAllSessions(prevAllSessions => {
          const updatedSessions = {
              ...prevAllSessions,
              [updatedSession.profile.subject]: updatedSession
          };
          
          // Save to localStorage inside the state update callback to ensure
          // we are saving the most recent, correct state.
          const sessionsKey = `tutorSessions_${currentUser}`;
          localStorage.setItem(sessionsKey, JSON.stringify(updatedSessions));
          
          return updatedSessions;
      });

      setCurrentSession(updatedSession);
  }, [currentUser]);

  const handleChatbotUpdate = useCallback((updatedMessages: ChatMessage[]) => {
      if (!currentUser) return;
      
      const chatbotKey = `chatbotHistory_${currentUser}`;
      setChatbotMessages(updatedMessages);
      localStorage.setItem(chatbotKey, JSON.stringify(updatedMessages));
  }, [currentUser]);


  const handleSelectSubject = (subjectName: string) => {
    const session = allSessions[subjectName];
    if (session) {
        setCurrentSession(session);
        setAppState('TUTOR_SESSION');
    }
  };

  const handleCreateNewSubject = () => {
    setAppState('WELCOME');
  };

  const handleDeleteSubject = (subjectName: string) => {
    if (!currentUser) return;

    const isConfirmed = window.confirm(`Bạn có chắc chắn muốn xóa môn học "${subjectName}" không? Toàn bộ lịch sử trò chuyện của môn này sẽ bị mất vĩnh viễn.`);

    if (isConfirmed) {
        setAllSessions(prevAllSessions => {
            const updatedSessions = { ...prevAllSessions };
            delete updatedSessions[subjectName];

            const sessionsKey = `tutorSessions_${currentUser}`;
            localStorage.setItem(sessionsKey, JSON.stringify(updatedSessions));

            return updatedSessions;
        });
    }
  };

  const handleStartNewConversation = useCallback(async (subjectName: string) => {
    if (!currentUser) return;

    const sessionToUpdate = allSessions[subjectName];
    if (!sessionToUpdate) return;

    setIsLoading(true);
    try {
        const initialMessageContent = await geminiService.generateInitialMessage(sessionToUpdate.profile);
        const initialMessage: ChatMessage = { role: 'model', content: initialMessageContent };

        const newConversation: Conversation = [initialMessage];
        const updatedConversations = [...sessionToUpdate.conversations, newConversation];

        const newSession: Session = {
            ...sessionToUpdate,
            conversations: updatedConversations,
            currentConversationIndex: updatedConversations.length - 1
        };

        const updatedAllSessions = { ...allSessions, [subjectName]: newSession };
        setAllSessions(updatedAllSessions);
        setCurrentSession(newSession);
        localStorage.setItem(`tutorSessions_${currentUser}`, JSON.stringify(updatedAllSessions));

    } catch (error) {
        console.error("Failed to start new conversation:", error);
        alert("Không thể bắt đầu cuộc trò chuyện mới. Vui lòng thử lại.");
    } finally {
        setIsLoading(false);
    }
  }, [allSessions, currentUser]);


  const renderContent = () => {
    if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} onRecoverPassword={handleRecoverPassword} />;
    }

    if (isLoading) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 text-center">
                <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">Đang tải buổi học...</h2>
                <div className="flex justify-center">
                   <LoadingSpinner />
                </div>
            </div>
        );
    }

    switch (appState) {
      case 'WELCOME':
        return <WelcomeScreen onSubmit={handleWelcomeSubmit} />;
      case 'SUBJECT_SELECTION':
        return <SubjectSelectionScreen 
            // FIX: Explicitly type `s` as `Session` to resolve type inference issue with Object.values.
            subjects={Object.values(allSessions).map((s: Session) => s.profile)} 
            onSelectSubject={handleSelectSubject}
            onNewSubject={handleCreateNewSubject}
            onDeleteSubject={handleDeleteSubject}
          />;
      case 'TUTOR_SESSION':
        return currentSession ? (
          <TutorSession 
            key={`${currentSession.profile.subject}-${currentSession.currentConversationIndex}`}
            session={currentSession}
            onLogout={handleLogout} 
            onSessionUpdate={handleSessionUpdate} 
            onSwitchSubject={handleSwitchSubject}
            onNewConversation={handleStartNewConversation}
          />
        ) : (
          <div className="text-center">
            <h2 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">Vui lòng chọn một môn học.</h2>
            <button onClick={handleSwitchSubject} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md">
              Quay lại danh sách
            </button>
          </div>
        );
      default:
        return <WelcomeScreen onSubmit={handleWelcomeSubmit} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center p-4 font-sans">
      {renderContent()}
      
      {currentUser && !isChatbotOpen && (
        <button
          onClick={() => setIsChatbotOpen(true)}
          className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 z-40"
          aria-label="Mở AI Chatbot"
          title="Mở AI Chatbot"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {isChatbotOpen && (
        <Chatbot 
            onClose={() => setIsChatbotOpen(false)} 
            initialMessages={chatbotMessages}
            onMessagesUpdate={handleChatbotUpdate}
        />
      )}
    </div>
  );
};

export default App;
