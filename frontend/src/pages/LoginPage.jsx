import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconWarning } from '../components/Icons';
import './LoginPage.css';

function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-ambient" />

      <div className="login-container animate-fade-in">
        {/* Logo / Brand */}
        <div className="login-brand">
          <h1 className="login-logo">RIDDIM</h1>
          <p className="login-tagline">AI‑powered EDM taste engine</p>
        </div>

        {/* Form Card */}
        <div className="login-card glass-card">
          {/* Mode Tabs */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Sign In
            </button>
            <button
              className={`login-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="display-name">Display Name</label>
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="DJ Shadow"
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={4}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <div className="login-error">
                <span className="error-icon"><IconWarning size={16} /></span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Loading...'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Sign In'
              }
            </button>
          </form>
        </div>

        <p className="login-footer">
          {mode === 'login' ? (
            <>New here? <button className="link-btn" onClick={() => setMode('register')}>Create an account</button></>
          ) : (
            <>Already have an account? <button className="link-btn" onClick={() => setMode('login')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
