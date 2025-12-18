import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; message: string; reason?: 'USER_NOT_FOUND' | 'WRONG_PASSWORD' }>;
  onRegister: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  onRecoverPassword: (username: string) => Promise<{ success: boolean; message: string; password?: string }>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister, onRecoverPassword }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RECOVER'>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userNotFound, setUserNotFound] = useState(false);

  const resetFormState = () => {
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    setUserNotFound(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUserNotFound(false);

    if (mode === 'RECOVER') {
        const result = await onRecoverPassword(username);
        if (result.success && result.password) {
            setSuccess(`Khôi phục thành công! Mật khẩu của bạn là: ${result.password}. Sẽ quay lại đăng nhập sau 4 giây...`);
            setTimeout(() => {
                switchMode('LOGIN');
            }, 4000); // Wait 4 seconds before redirecting
        } else {
            setError(result.message);
        }
        return;
    }
    
    if (mode === 'REGISTER') {
        const result = await onRegister(username, password);
        if (result.success) {
            setSuccess(result.message);
            setMode('LOGIN'); // Switch to login view after successful registration
            resetFormState();
        } else {
            setError(result.message);
        }
    } else if (mode === 'LOGIN') {
        const result = await onLogin(username, password);
        if (!result.success) {
            if (result.reason === 'USER_NOT_FOUND') {
                setUserNotFound(true);
            } else {
                setError(result.message);
            }
        }
        // On successful login, the parent component handles the state change.
    }
  };
  
  const switchMode = (newMode: 'LOGIN' | 'REGISTER' | 'RECOVER') => {
    setMode(newMode);
    resetFormState();
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-8 transition-all duration-500">
      <h1 className="text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400 mb-2">
        {mode === 'LOGIN' && 'Đăng Nhập'}
        {mode === 'REGISTER' && 'Đăng Ký'}
        {mode === 'RECOVER' && 'Khôi phục Mật khẩu'}
      </h1>
      <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
        {mode === 'LOGIN' && 'Chào mừng bạn trở lại!'}
        {mode === 'REGISTER' && 'Tạo tài khoản để bắt đầu học'}
        {mode === 'RECOVER' && 'Nhập tên tài khoản của bạn để lấy lại mật khẩu.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tài khoản</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập tên tài khoản"
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            required
            autoComplete="username"
          />
        </div>

        {mode !== 'RECOVER' && (
          <div>
            <div className="flex justify-between items-baseline">
                {/* FIX: Replaced invalid property 'นาง' with 'className' which was causing a type error. */}
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mật khẩu</label>
                {mode === 'LOGIN' && (
                    <button type="button" onClick={() => switchMode('RECOVER')} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none">
                        Quên mật khẩu?
                    </button>
                )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              required
              autoComplete={mode === 'REGISTER' ? "new-password" : "current-password"}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}
        {userNotFound && (
            <p className="text-sm text-red-500 dark:text-red-400 text-center">
                Tên đăng nhập không tồn tại.{" "}
                <button
                    type="button"
                    onClick={() => switchMode('REGISTER')}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
                >
                    Đăng ký ngay
                </button>
            </p>
        )}
        {success && <p className="text-sm text-green-600 dark:text-green-400 text-center font-semibold">{success}</p>}

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-transform transform hover:scale-105"
        >
          {mode === 'LOGIN' && 'Đăng Nhập'}
          {mode === 'REGISTER' && 'Đăng Ký'}
          {mode === 'RECOVER' && 'Lấy lại Mật khẩu'}
        </button>
      </form>
      
      <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
        {mode === 'LOGIN' && 'Chưa có tài khoản?'}
        {mode === 'REGISTER' && 'Đã có tài khoản?'}
        {mode === 'RECOVER' && 'Nhớ mật khẩu rồi?'}
        <button
          onClick={() => switchMode(mode === 'LOGIN' || mode === 'RECOVER' ? 'REGISTER' : 'LOGIN')}
          className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline ml-1 focus:outline-none"
        >
          {mode === 'LOGIN' || mode === 'RECOVER' ? 'Đăng ký ngay' : 'Đăng nhập'}
        </button>
      </p>
    </div>
  );
};

export default LoginScreen;