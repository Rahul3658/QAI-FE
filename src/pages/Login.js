import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { login, user, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  // If user is already logged in, redirect them to their dashboard
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin') {
        navigate('/super-admin');
      } else if (user.role === 'moderator') {
        navigate('/moderator');
      } else if (user.role === 'examiner') {
        navigate('/examiner');
      } else if (user.role === 'subject_matter_expert') {
        navigate('/subject-matter-expert');
      } else {
        // default
        navigate('/');
      }
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
  setError('');
  setSubmitting(true);

    try {
      const data = await login(email, password, twoFactorCode);
      
      // Check if 2FA is required
      if (data.requires2FA) {
        setRequires2FA(true);
        setSubmitting(false);
        return;
      }
      
      // Redirect based on role
      if (data.user.role === 'super_admin') {
        navigate('/super-admin');
      } else if (data.user.role === 'moderator') {
        navigate('/moderator');
      } else if (data.user.role === 'examiner') {
        navigate('/examiner');
      } else if (data.user.role === 'subject_matter_expert') {
        navigate('/subject-matter-expert');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={requires2FA}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={requires2FA}
            />
          </div>

          {requires2FA && (
            <div className="form-group">
              <label className="form-label">🔐 Two-Factor Authentication Code</label>
              <input
                type="text"
                className="form-input"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                required
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          )}

          {requires2FA && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: '1rem' }}
              onClick={() => {
                setRequires2FA(false);
                setTwoFactorCode('');
              }}
            >
              ← Back
            </button>
          )}

          <button type="submit" className="btn btn-primary" style={{width: '100%'}} disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
