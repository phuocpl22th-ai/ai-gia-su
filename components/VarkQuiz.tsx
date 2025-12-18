
import React, { useState } from 'react';
import { VarkStyle, QuizQuestion } from '../types';

interface VarkQuizProps {
  questions: QuizQuestion[];
  onComplete: (style: VarkStyle) => void;
}

const VarkQuiz: React.FC<VarkQuizProps> = ({ questions, onComplete }) => {
  const [answers, setAnswers] = useState<Partial<Record<VarkStyle, number>>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const finishQuiz = (lastAnswerStyle: VarkStyle) => {
    const finalScores = { ...answers, [lastAnswerStyle]: (answers[lastAnswerStyle] || 0) + 1 };
    
    let dominantStyle: VarkStyle = 'Visual';
    let maxScore = 0;
    
    for (const style in finalScores) {
        const varkStyle = style as VarkStyle;
        if ((finalScores[varkStyle] || 0) > maxScore) {
            maxScore = finalScores[varkStyle] || 0;
            dominantStyle = varkStyle;
        }
    }
    
    onComplete(dominantStyle);
  };

  const handleAnswer = (style: VarkStyle) => {
    if (currentQuestionIndex < questions.length - 1) {
      setAnswers(prev => ({ ...prev, [style]: (prev[style] || 0) + 1 }));
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishQuiz(style);
    }
  };


  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 transition-all duration-500 animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-indigo-600 dark:text-indigo-400 mb-4">Xác định phong cách học tập</h2>
      <p className="text-center text-slate-600 dark:text-slate-400 mb-8">Trả lời vài câu hỏi nhanh để tôi có thể tùy chỉnh bài học cho bạn.</p>
      
      <div className="mb-6">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease-in-out' }}></div>
          </div>
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">{currentQuestion.question}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(option.style)}
              className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-lg text-left hover:bg-indigo-50 dark:hover:bg-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VarkQuiz;
