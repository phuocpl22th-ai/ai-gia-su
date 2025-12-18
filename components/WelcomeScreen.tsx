import React, { useState } from 'react';
import { UserProfile, PrebuiltVoice } from '../types';
import { SUPPORTED_VOICES } from '../services/geminiService';

interface WelcomeScreenProps {
  onSubmit: (data: Omit<UserProfile, 'username'>) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSubmit }) => {
  const [goal, setGoal] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('Khá');
  const [voice, setVoice] = useState<PrebuiltVoice>(SUPPORTED_VOICES[0].id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim() && subject.trim()) {
      onSubmit({ goal, subject, level, voice });
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 transition-all duration-500">
      <h1 className="text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400 mb-2">Chào mừng bạn!</h1>
      <p className="text-center text-slate-600 dark:text-slate-400 mb-8">Tôi là gia sư AI cá nhân của bạn. Hãy bắt đầu bằng cách cho tôi biết mục tiêu học tập của bạn nhé.</p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Môn học bạn muốn học?</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ví dụ: Lịch sử Việt Nam, Vật lý lớp 10..."
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            required
          />
        </div>

        <div>
          <label htmlFor="goal" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mục tiêu của bạn là gì?</label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ví dụ: Nắm vững kiến thức cơ bản, chuẩn bị cho kỳ thi..."
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            rows={3}
            required
          />
        </div>

        <div>
          <label htmlFor="level" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trình độ hiện tại của bạn?</label>
          <select
            id="level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          >
            <option>Giỏi</option>
            <option>Khá</option>
            <option>Trung bình</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="voice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Giọng nói của gia sư</label>
          <select
            id="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value as PrebuiltVoice)}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          >
            {SUPPORTED_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <button 
          type="submit"
          className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-transform transform hover:scale-105"
        >
          Tiếp tục
        </button>
      </form>
    </div>
  );
};

export default WelcomeScreen;