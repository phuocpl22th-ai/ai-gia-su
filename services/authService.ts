// This service handles user authentication logic (login, register, logout)
// and interacts with localStorage to persist user data and session state.
// WARNING: This is a simple implementation for demonstration purposes.
// Storing passwords in localStorage is not secure for a production application.

const USERS_KEY = 'appUsers';
const CURRENT_USER_KEY = 'appCurrentUser';

const getUsers = (): Record<string, string> => {
  try {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : {};
  } catch {
    return {};
  }
};

const saveUsers = (users: Record<string, string>) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const register = (username: string, password: string): { success: boolean; message: string } => {
  if (!username.trim() || !password.trim()) {
    return { success: false, message: "Tên đăng nhập và mật khẩu không được để trống." };
  }
  const users = getUsers();
  if (users[username]) {
    return { success: false, message: "Tên đăng nhập đã tồn tại." };
  }
  users[username] = password; // In a real app, hash the password!
  saveUsers(users);
  return { success: true, message: "Đăng ký thành công! Vui lòng đăng nhập." };
};

export const login = (username: string, password: string): { success: boolean; message: string; reason?: 'USER_NOT_FOUND' | 'WRONG_PASSWORD' } => {
  const users = getUsers();
  if (!users[username]) {
    return { success: false, message: "Tên đăng nhập không tồn tại.", reason: 'USER_NOT_FOUND' };
  }
  if (users[username] !== password) {
    return { success: false, message: "Mật khẩu không chính xác.", reason: 'WRONG_PASSWORD' };
  }
  localStorage.setItem(CURRENT_USER_KEY, username);
  return { success: true, message: "Đăng nhập thành công!" };
};

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): string | null => {
  return localStorage.getItem(CURRENT_USER_KEY);
};

export const recoverPassword = (username: string): { success: boolean; message: string; password?: string } => {
    const users = getUsers();
    if (!users[username]) {
        return { success: false, message: "Tên đăng nhập không tồn tại." };
    }
    // WARNING: Returning the raw password is insecure. For demo purposes only.
    return { success: true, message: "Khôi phục thành công! Mật khẩu của bạn là:", password: users[username] };
};