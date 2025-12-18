
import React, { useState } from 'react';
import { GeneratedQuiz } from '../types';

interface QuizViewProps {
  quizData: GeneratedQuiz;
  onQuizComplete: (score: number, total: number) => void;
}

const QuizView: React.FC<QuizViewProps> = ({ quizData, onQuizComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const totalQuestions = quizData.questions.length;

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer) return; // Already answered

    setSelectedAnswer(option);
    const correct = option === currentQuestion.answer;
    setIsCorrect(correct);
    if (correct) {
      setScore(prevScore => prevScore + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
    } else {
      // Quiz finished
      onQuizComplete(score, totalQuestions);
    }
  };

  if (!currentQuestion) {
    return null; // Or some loading/error state
  }

  return (
    <div className="my-4 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-inner animate-fade-in">
      <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-4">Bài kiểm tra nhanh</h3>
      <p className="font-semibold mb-1 text-slate-700 dark:text-slate-300">Câu {currentQuestionIndex + 1}/{totalQuestions}</p>
      <p className="mb-4 text-slate-800 dark:text-slate-200">{currentQuestion.question}</p>
      
      <div className="space-y-3">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedAnswer === option;
          const isTheCorrectAnswer = currentQuestion.answer === option;
          let buttonClass = 'w-full p-3 text-left border rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed';

          if (selectedAnswer) { // An answer has been selected
            if (isTheCorrectAnswer) {
              buttonClass += ' bg-green-100 border-green-400 dark:bg-green-900 dark:border-green-600 text-green-800 dark:text-green-200';
            } else if (isSelected) {
              buttonClass += ' bg-red-100 border-red-400 dark:bg-red-900 dark:border-red-600 text-red-800 dark:text-red-200';
            } else {
              buttonClass += ' border-slate-300 dark:border-slate-600';
            }
          } else { // No answer selected yet
            buttonClass += ' border-slate-300 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700';
          }
          
          return (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              disabled={!!selectedAnswer}
              className={buttonClass}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selectedAnswer && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-slate-800 rounded-md border border-blue-200 dark:border-slate-600 animate-fade-in">
          <p className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            {isCorrect ? 'Chính xác! 🎉' : 'Chưa đúng lắm.'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-400">{currentQuestion.explanation}</p>
          <button
            onClick={handleNextQuestion}
            className="mt-4 w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {currentQuestionIndex < totalQuestions - 1 ? 'Câu tiếp theo' : 'Hoàn thành'}
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizView;
