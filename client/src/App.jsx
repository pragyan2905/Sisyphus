import { useState, useEffect } from 'react'
import './index.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function App() {
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({ name: '', url: '', interval_minutes: 5 });
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [token, setToken] = useState(localStorage.getItem('jwt_token') || null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('jwt_token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const getHeaders = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchServices = async () => {
    if (!token) return; // Don't fetch if not logged in
    try {
      const res = await fetch(`${API_BASE_URL}/services`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const servicesWithHistory = await Promise.all(data.map(async (service) => {
          try {
            const histRes = await fetch(`${API_BASE_URL}/services/${service.id}/history`, { headers: getHeaders() });
            let latestPing = null;
            if (histRes.ok) {
              const history = await histRes.json();
              if (history.length > 0) {
                latestPing = history[0]; 
              }
            }
            return { ...service, latestPing };
          } catch (e) {
             return { ...service, latestPing: null };
          }
        }));
        setServices(servicesWithHistory);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.url) return;
    if (!token) {
      alert("Please log in first.");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({ name: '', url: '', interval_minutes: 5 });
        fetchServices();
      } else {
        const errorData = await res.json();
        alert(`Failed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="top-nav">
        <div className="nav-logo">
          <div className="pulse-dot"></div>
          Sisyphus
        </div>
        <div className="nav-links">
          <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer" style={{color: 'inherit', textDecoration: 'none'}}>API Documentation</a>
          <span>Pricing</span>
        </div>
        <div className="auth-buttons">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ background: 'transparent', border: `1px solid var(--border-color)`, color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          {token ? (
            <button 
              className="login-btn" 
              onClick={() => { localStorage.removeItem('jwt_token'); setToken(null); setServices([]); }}
            >
              Log out
            </button>
          ) : (
            <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/login`} className="login-btn">Log in with Google</a>
          )}
          <button className="signup-btn">Get started free</button>
        </div>
      </nav>

      <header className="hero">
        <div className="trust-badge">
          Engineered for absolute reliability.
        </div>
        <h1>
          Keep your services alive and <br/>
          <span className="accent-text">lightning fast</span>.
        </h1>
        <div className="hero-features">
          <span><span className="check-icon">✓</span> Up to 5 Free Monitors</span>
          <span><span className="check-icon">✓</span> Zero Cold Starts</span>
          <span><span className="check-icon">✓</span> Instant Observability</span>
          <span><span className="check-icon">✓</span> Background Processing</span>
        </div>
      </header>

      <div className="container">
        
        {/* Sleek Pill Form */}
        <div className="pill-form-container">
          <form className="pill-form" onSubmit={handleSubmit}>
            <input 
              type="text" 
              className="pill-input" 
              placeholder="e.g. Production API"
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
            <input 
              type="url" 
              className="pill-input pill-input-small" 
              placeholder="eg. mywebsite.com"
              required
              value={formData.url}
              onChange={e => setFormData({...formData, url: e.target.value})}
            />
            <select 
              className="pill-input pill-input-small" 
              required
              value={formData.interval_minutes}
              onChange={e => setFormData({...formData, interval_minutes: parseInt(e.target.value)})}
              title="Interval in Minutes"
              style={{cursor: 'pointer'}}
            >
              <option value="5">5 Min</option>
              <option value="10">10 Min</option>
              <option value="15">15 Min</option>
              <option value="20">20 Min</option>
              <option value="30">30 Min</option>
            </select>
            <button type="submit" className="pill-btn" disabled={loading}>
              {loading ? 'Adding...' : 'Start monitoring for free'}
            </button>
          </form>
        </div>

        {/* Dashboard Mockup */}
        <div className="dashboard-frame">
          <div className="section-header">
            <h2>Monitoring Dashboard</h2>
            <button onClick={fetchServices} className="icon-btn" title="Refresh">↻</button>
          </div>
          
          <div className="services-grid">
            {services.length === 0 ? (
              <p style={{color: 'var(--text-secondary)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem'}}>
                Your dashboard is empty. Add a service above!
              </p>
            ) : (
              services.map(service => (
                <div key={service.id} className="service-card">
                  <div className="card-header">
                    <div className="card-title">{service.name}</div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: #{service.id} | {service.interval_minutes}m</span>
                  </div>
                  <div className="card-url">{service.url}</div>
                  
                  {service.latestPing ? (
                    <div className="ping-status">
                      <div className="ping-status-text" style={{ color: service.latestPing.is_success ? 'var(--success)' : 'var(--danger)' }}>
                        <span className="status-dot" style={{ backgroundColor: service.latestPing.is_success ? 'var(--success)' : 'var(--danger)' }}></span>
                        {service.latestPing.status_code} OK
                        <span style={{color: 'var(--text-primary)', marginLeft: 'auto', fontWeight: 'normal'}}>{Math.round(service.latestPing.response_time_ms)}ms</span>
                      </div>
                      <div className="ping-time">
                        Checked {new Date(service.latestPing.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ) : (
                    <div className="ping-status">
                      <div className="ping-status-text" style={{ color: 'var(--text-secondary)' }}>
                        <span className="status-dot" style={{ backgroundColor: 'var(--text-secondary)' }}></span>
                        Pending First Check...
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </>
  )
}

export default App
