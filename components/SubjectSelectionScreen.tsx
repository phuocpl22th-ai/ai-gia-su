
import React from 'react';
import { UserProfile } from '../types';

interface SubjectSelectionScreenProps {
  subjects: UserProfile[];
  onSelectSubject: (subjectName: string) => void;
  onNewSubject: () => void;
  onDeleteSubject: (subjectName: string) => void;
}

const SubjectSelectionScreen: React.FC<SubjectSelectionScreenProps> = ({ subjects, onSelectSubject, onNewSubject, onDeleteSubject }) => {
  return (
    <div className="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 transition-all duration-500 animate-fade-in">
      <h1 className="text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400 mb-2">Chọn môn học</h1>
      <p className="text-center text-slate-600 dark:text-slate-400 mb-8">Tiếp tục một buổi học trước hoặc bắt đầu một môn mới.</p>
      
      <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-2">
        {subjects.length > 0 ? (
            subjects.map(profile => (
              <div key={profile.subject} className="flex items-center gap-2">
                <button
                  onClick={() => onSelectSubject(profile.subject)}
                  className="flex-grow text-left p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border-2 border-slate-200 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label={`Tiếp tục học môn ${profile.subject}`}
                >
                  <h2 className="font-bold text-lg text-slate-800 dark:text-slate-200">{profile.subject}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Mục tiêu: {profile.goal}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Trình độ: {profile.level}</p>
                </button>
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSubject(profile.subject);
                    }}
                    className="p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Xóa môn học ${profile.subject}`}
                    title={`Xóa môn học ${profile.subject}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
              </div>
            ))
        ) : (
            <p className="text-center text-slate-500 dark:text-slate-400 py-4">Chưa có môn học nào. Hãy tạo môn học đầu tiên của bạn!</p>
        )}
      </div>

      <button
        onClick={onNewSubject}
        className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
      >
        + Tạo môn học mới
      </button>
    </div>
  );
};

export default SubjectSelectionScreen;
