import React, { createContext, useState, useEffect, useRef } from 'react';
import API from '../api/axios';

export const AuthContext = createContext();

// Helper: decode a JWT without adding a new dependency. Returns payload or null.
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Add padding if necessary
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutTimer = useRef(null);

  const scheduleLogout = (expiryMs) => {
    // Clear previous timer
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }

    const now = Date.now();
    const ms = expiryMs - now;
    if (ms > 0) {
      logoutTimer.current = setTimeout(() => {
        logout();
      }, ms);
    } else {
      // Already expired
      logout();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const tokenExpiry = localStorage.getItem('tokenExpiry');

    if (token && userData) {
      // If tokenExpiry exists, check it. Otherwise try to decode token's exp claim.
      let expiryMs = tokenExpiry ? parseInt(tokenExpiry, 10) : null;
      if (!expiryMs) {
        const payload = decodeJwt(token);
        if (payload && payload.exp) {
          expiryMs = payload.exp * 1000;
        }
      }

      if (expiryMs) {
        if (Date.now() >= expiryMs) {
          // expired
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('tokenExpiry');
          setUser(null);
        } else {
          setUser(JSON.parse(userData));
          scheduleLogout(expiryMs);
        }
      } else {
        // No expiry info; set user but schedule a fallback logout in 7 days
        const fallback = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('tokenExpiry', String(fallback));
        setUser(JSON.parse(userData));
        scheduleLogout(fallback);
      }
    }

    setLoading(false);

    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTokenWithExpiry = (token) => {
    localStorage.setItem('token', token);
    const payload = decodeJwt(token);
    let expiryMs;
    if (payload && payload.exp) {
      expiryMs = payload.exp * 1000;
    } else {
      // fallback to 7 days
      expiryMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    }
    localStorage.setItem('tokenExpiry', String(expiryMs));
    scheduleLogout(expiryMs);
  };

  const login = async (email, password, twoFactorCode = '') => {
    const { data } = await API.post('/auth/login', { email, password, twoFactorCode });

    if (data.success && data.token) {
      setTokenWithExpiry(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    }

    return data;
  };

  const register = async (formData) => {
    const { data } = await API.post('/auth/register', formData);
    if (data.token) {
      setTokenWithExpiry(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
