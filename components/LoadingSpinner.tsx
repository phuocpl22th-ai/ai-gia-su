
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center space-x-2 px-4 py-3 bg-white dark:bg-slate-700 rounded-2xl shadow-md">
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></div>
    </div>
  );
};

export default LoadingSpinner;
