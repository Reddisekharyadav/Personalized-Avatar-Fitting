import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userEmail', email);
      router.push('/wardrobe');
    } catch {
      setError('Invalid email or password.');
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <h1 className="login-title">Login</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="login-input" required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="login-input" required />
          <button type="submit" className="login-btn">Login</button>
          {error && <div className="login-error">{error}</div>}
        </form>
      </div>
    <style jsx>{`
      .login-bg {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #e0e7ff 0%, #fdf6fd 100%);
        animation: animated-bg 12s ease-in-out infinite alternate;
        background-size: 200% 200%;
      }
      @keyframes animated-bg {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .login-card {
        background: rgba(255,255,255,0.85);
        box-shadow: 0 8px 32px 0 rgba(31,38,135,0.12);
        border-radius: 2rem;
        border: 1.5px solid rgba(255,255,255,0.25);
        padding: 2.5rem 2rem;
        max-width: 400px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1.2rem;
      }
      .login-title {
        font-size: 2.2rem;
        font-weight: 900;
        color: #2563eb;
        text-align: center;
        margin-bottom: 1.5rem;
        letter-spacing: -0.02em;
      }
      .login-input {
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        border: 1.5px solid #c7d2fe;
        font-size: 1.1rem;
        font-weight: 600;
        outline: none;
        transition: border 0.2s;
      }
      .login-input:focus {
        border: 1.5px solid #6366f1;
      }
      .login-btn {
        background: linear-gradient(90deg, #4f8cff 0%, #1e3a8a 100%);
        color: #fff;
        font-weight: 800;
        font-size: 1.2rem;
        border: none;
        border-radius: 2rem;
        padding: 0.9rem 0;
        box-shadow: 0 8px 32px 0 rgba(31,38,135,0.18);
        cursor: pointer;
        transition: all 0.18s cubic-bezier(.4,0,.2,1);
      }
      .login-btn:hover, .login-btn:focus {
        filter: brightness(1.10) drop-shadow(0 0 16px rgba(79,140,255,0.13));
        box-shadow: 0 16px 40px 0 rgba(31,38,135,0.22);
        transform: scale(1.04) translateY(-2px);
        outline: 2px solid #a5b4fc;
      }
      .login-btn:active {
        transform: scale(0.97) translateY(1px);
        filter: brightness(0.96);
        box-shadow: 0 4px 12px 0 rgba(31,38,135,0.10);
      }
      .login-error {
        color: #dc2626;
        text-align: center;
        font-weight: 700;
        margin-top: 0.5rem;
      }
    `}</style>
    </div>
  );
}
