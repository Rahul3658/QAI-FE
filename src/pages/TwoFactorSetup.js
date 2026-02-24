import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

const TwoFactorSetup = () => {
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const { data } = await API.get('/auth/2fa/status');
      setIsEnabled(data.enabled);
    } catch (err) {
      console.error('Failed to check 2FA status');
    }
  };

  const handleSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await API.post('/auth/2fa/setup');
      setQrCode(data.qrCode);
      setSecret(data.secret);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await API.post('/auth/2fa/verify', { token });
      setSuccess('2FA enabled successfully!');
      setTimeout(() => navigate(-1), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid token');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to disable 2FA?')) return;

    try {
      setLoading(true);
      setError('');
      await API.post('/auth/2fa/disable', { password });
      setSuccess('2FA disabled successfully!');
      setIsEnabled(false);
      setPassword('');
      setQrCode('');
      setSecret('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">🔐 Two-Factor Authentication</h1>
        <p className="dashboard-subtitle">Secure your account with 2FA</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ padding: '2rem' }}>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          {isEnabled ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                <h3 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>2FA is Enabled</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Your account is protected with two-factor authentication</p>
              </div>

              <form onSubmit={handleDisable}>
                <div className="form-group">
                  <label className="form-label">Enter your password to disable 2FA</label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Disabling...' : '🔓 Disable 2FA'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              {!qrCode ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Enable Two-Factor Authentication</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Add an extra layer of security to your account by requiring a code from your authenticator app.
                  </p>

                  <div className="info-box" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                    <strong>📱 How to set up:</strong>
                    <ul>
                      <li>Download Google Authenticator or any TOTP app</li>
                      <li>Click "Setup 2FA" to generate a QR code</li>
                      <li>Scan the QR code with your authenticator app</li>
                      <li>Enter the 6-digit code to verify</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleSetup}
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: '100%' }}
                  >
                    {loading ? 'Setting up...' : '🚀 Setup 2FA'}
                  </button>
                </div>
              ) : (
                <div>
                  <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Scan QR Code</h3>

                  <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ 
                      background: 'white', 
                      padding: '1rem', 
                      borderRadius: '1rem', 
                      display: 'inline-block',
                      boxShadow: 'var(--shadow-md)'
                    }}>
                      <img src={qrCode} alt="QR Code" style={{ width: '250px', height: '250px' }} />
                    </div>
                  </div>

                  <div className="info-box" style={{ marginBottom: '1.5rem' }}>
                    <strong>📝 Manual Entry:</strong>
                    <p style={{ marginTop: '0.5rem', wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {secret}
                    </p>
                  </div>

                  <form onSubmit={handleVerify}>
                    <div className="form-group">
                      <label className="form-label">Enter 6-digit code from your authenticator app</label>
                      <input
                        type="text"
                        className="form-input"
                        value={token}
                        onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength="6"
                        required
                        style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={loading || token.length !== 6}
                      style={{ width: '100%' }}
                    >
                      {loading ? 'Verifying...' : '✅ Verify and Enable'}
                    </button>
                  </form>

                  <button
                    onClick={() => {
                      setQrCode('');
                      setSecret('');
                      setToken('');
                    }}
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '1rem' }}
                  >
                    ← Back
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;
