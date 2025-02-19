import { useState } from 'react';
import Login from './Login';

function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return <Login />;
  }

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="logo">
          <span className="icon">📱</span>
          TabletTracker
        </div>
        <button onClick={() => setShowLogin(true)} className="login-btn">
          Login
        </button>
      </nav>
      
      <div className="hero-section">
        <div className="hero-content">
          <h1>Keep Your Students' Tablets Safe & Secure</h1>
          <p className="subtitle">
            Comprehensive tablet tracking and management system for educational institutions
          </p>
          <div className="cta-buttons">
            <button onClick={() => setShowLogin(true)} className="get-started-btn">
              GET STARTED
            </button>
            <button className="learn-more-btn">
              LEARN MORE
            </button>
          </div>
        </div>
        
        <div className="stats-section">
          <div className="stat-box">
            <h2>5K+</h2>
            <p>Tablets Tracked</p>
          </div>
          <div className="stat-box">
            <h2>100+</h2>
            <p>Schools</p>
          </div>
          <div className="stat-box">
            <h2>24/7</h2>
            <p>Monitoring</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage; 