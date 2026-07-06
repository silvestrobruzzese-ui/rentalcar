import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          console.error('Auth init error:', error);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!token && (!!user || loading);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      isAdmin,
      isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// API helper with auth
export const api = {
  get: async (url, token) => {
    const response = await axios.get(`${API}${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  },
  post: async (url, data, token) => {
    const response = await axios.post(`${API}${url}`, data, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  },
  put: async (url, data, token) => {
    const response = await axios.put(`${API}${url}`, data, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  },
  patch: async (url, data, token) => {
    const response = await axios.patch(`${API}${url}`, data, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  },
  delete: async (url, token) => {
    const response = await axios.delete(`${API}${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.data;
  }
};
