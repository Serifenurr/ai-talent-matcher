import React, { useState } from 'react';
import axios from 'axios';
import { Bot, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export default function Login({ setToken }) {
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const response = await axios.post(`${API_BASE}/token`, {
        username: 'ceo',
        password: password
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const accessToken = response.data.access_token;
      setToken(accessToken);
      localStorage.setItem('hr_token', accessToken);
    } catch {
      setLoginError('Invalid CEO Password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = (e) => {
    e.preventDefault();
    setToken('guest');
    localStorage.setItem('hr_token', 'guest');
  };

  return (
    <div className="login-view">
      <div className="glass login-card premium-shadow">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="blue-neon" style={{ background: 'linear-gradient(135deg, #00f2ff, #008ba3)', padding: '1.2rem', borderRadius: '50%', color: '#0b0612' }}>
            <Bot size={44} />
          </div>
        </div>
        <h2>AI Talent Matcher</h2>
        <p>Login to semantic search portal</p>
        
        <form onSubmit={handleLogin} style={{ marginBottom: '1rem' }}>
          <div className="input-group">
            <input 
              type="password" 
              placeholder="Manager Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {loginError && <div className="error-msg" style={{marginBottom: "1.5rem"}}>{loginError}</div>}
          <button type="submit" className="btn-primary" disabled={isLoggingIn}>
            {isLoggingIn ? <div className="loader" /> : 'Sisteme Giriş Yap'}
          </button>
        </form>
        
        <div style={{ position: 'relative', margin: '2rem 0', textAlign: 'center' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
          <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-surface)', padding: '0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            VEYA
          </span>
        </div>
        
        <button 
          onClick={handleGuestLogin} 
          className="btn-primary" 
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', width: '100%' }}
        >
          Misafir Olarak Dene
        </button>
      </div>
    </div>
  );
}
