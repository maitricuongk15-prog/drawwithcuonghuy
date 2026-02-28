import { useState } from 'react';
import { loginUser, registerUser } from '../services/authApi';

export function useAuth({ onLoginSuccess, onLogout, notify, requestConfirm }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState({ type: '', message: '' });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const toggleAuthMode = () => {
    setIsLogin((prev) => !prev);
    setPassword('');
    setAuthStatus({ type: '', message: '' });
  };

  const handleRegister = async () => {
    if (!username || !password || !displayName) {
      const message = 'Please fill in all required registration fields.';
      setAuthStatus({ type: 'error', message });
      notify?.({ type: 'error', message });
      return;
    }

    setLoading(true);
    setAuthStatus({ type: 'info', message: 'Creating account...' });
    try {
      const { response, data } = await registerUser({ username, password, displayName });
      if (response.ok && data.success) {
        const message = 'Account created successfully. You can sign in now.';
        setAuthStatus({ type: 'success', message });
        notify?.({ type: 'success', message: 'Registration successful. Please sign in.' });
        setIsLogin(true);
        setPassword('');
      } else {
        const message = data.message || 'Registration failed.';
        setAuthStatus({ type: 'error', message });
        notify?.({ type: 'error', message });
      }
    } catch (error) {
      const message = error.message || 'Cannot connect to server.';
      setAuthStatus({ type: 'error', message });
      notify?.({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      const message = 'Please enter username and password.';
      setAuthStatus({ type: 'error', message });
      notify?.({ type: 'error', message });
      return;
    }

    setLoading(true);
    setAuthStatus({ type: 'info', message: 'Signing in...' });
    try {
      const { response, data, baseUrl } = await loginUser({ username, password });
      if (response.ok && data.success) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);

        const userLabel = data.user?.displayName || data.user?.username || '';
        setAuthStatus({
          type: 'success',
          message: `Login successful. Welcome ${userLabel}`.trim(),
        });
        notify?.({
          type: 'success',
          message: `Login successful: ${userLabel}`.trim(),
        });

        onLoginSuccess?.({
          ...data.user,
          serverUrlUsed: baseUrl || '',
        });
      } else {
        const message = data.message || 'Login failed.';
        setAuthStatus({ type: 'error', message });
        notify?.({ type: 'error', message });
      }
    } catch (error) {
      const message = error.message || 'Cannot connect to server.';
      setAuthStatus({ type: 'error', message });
      notify?.({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    const doLogout = () => {
      onLogout?.();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setUsername('');
      setPassword('');
      setDisplayName('');
      setAuthStatus({ type: '', message: '' });
      notify?.({ type: 'info', message: 'You have been logged out.' });
    };

    if (!requestConfirm) {
      doLogout();
      return;
    }

    requestConfirm({
      title: 'Logout',
      message: 'Are you sure you want to log out?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      onConfirm: doLogout,
    });
  };

  return {
    isAuthenticated,
    isLogin,
    loading,
    authStatus,
    username,
    password,
    displayName,
    currentUser,
    setUsername,
    setPassword,
    setDisplayName,
    toggleAuthMode,
    handleRegister,
    handleLogin,
    handleLogout,
  };
}
