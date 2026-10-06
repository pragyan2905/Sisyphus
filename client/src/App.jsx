import { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function App() {
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({ name: '', url: '', interval_minutes: 5 });
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [token, setToken] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'pricing'
  
  // New state for details view
  const [selectedService, setSelectedService] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('jwt_token', urlToken);
      window.history.replaceState({}, document.title, "/");
      setToken(urlToken);
    } else {
      const storedToken = localStorage.getItem('jwt_token');
      if (storedToken) setToken(storedToken);
    }
  }, []);

  const getHeaders = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchServices = async () => {
    if (!token) return;
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
        
        // If a service is currently selected, refresh its history too
        if (selectedService) {
          const updatedSelected = servicesWithHistory.find(s => s.id === selectedService.id);
          if (updatedSelected) {
            setSelectedService(updatedSelected);
            fetchServiceHistory(updatedSelected.id);
          } else {
            setSelectedService(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  const fetchServiceHistory = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/services/${id}/history`, { headers: getHeaders() });
      if (res.ok) {
        setServiceHistory(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    fetchServices();
    
    // Auto-refresh every 10 seconds
    const intervalId = setInterval(() => {
      fetchServices();
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [token]);

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

  const handlePause = async (id) => {
    if (!window.confirm("Are you sure you want to pause/resume this service?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/services/${id}/toggle-pause`, {
        method: 'PUT',
        headers: getHeaders()
      });
      if (res.ok) {
        fetchServices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to DELETE this service permanently?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/services/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setSelectedService(null);
        fetchServices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getNextPingTime = (service) => {
    if (!service.is_active) return "Paused";
    if (!service.latestPing) return "Pending...";
    const lastTime = new Date(service.latestPing.timestamp);
    const nextTime = new Date(lastTime.getTime() + service.interval_minutes * 60000);
    return nextTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const getFuturePings = (service) => {
    if (!service.is_active) return [];
    let baseTime = service.latestPing ? new Date(service.latestPing.timestamp) : new Date();
    const futures = [];
    for (let i = 1; i <= 3; i++) {
      baseTime = new Date(baseTime.getTime() + service.interval_minutes * 60000);
      futures.push(baseTime.toLocaleTimeString());
    }
    return futures;
  };

  const openDetails = (service) => {
    setSelectedService(service);
    fetchServiceHistory(service.id);
  };

  return (
    <>
      <nav className="top-nav">
        <div className="nav-logo" onClick={() => { setView('dashboard'); setSelectedService(null); }} style={{cursor: 'pointer'}}>
          <div className="pulse-dot"></div>
          Sisyphus
        </div>
        <div className="nav-links">
          <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer" style={{color: 'inherit', textDecoration: 'none'}}>API Documentation</a>
          <span onClick={() => { setView('pricing'); setSelectedService(null); }} style={{cursor: 'pointer'}}>Pricing</span>
        </div>
        <div className="auth-buttons">
          {token ? (
            <button 
              className="login-btn" 
              onClick={() => { localStorage.removeItem('jwt_token'); setToken(null); setServices([]); setSelectedService(null); }}
            >
              Log out
            </button>
          ) : (
            <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/login`} className="login-btn" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Log in with Google
            </a>
          )}
          <button className="signup-btn">Get started free</button>
        </div>
      </nav>

      {view === 'pricing' ? (
        // --- PRICING VIEW ---
        <div className="container" style={{marginTop: '4rem', textAlign: 'center'}}>
          <h1 style={{fontSize: '3rem', marginBottom: '1rem'}}>Simple, transparent pricing</h1>
          <p style={{color: 'var(--text-secondary)', marginBottom: '4rem', fontSize: '1.2rem'}}>Start for free, scale when you need to.</p>
          
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem'}}>
            {/* Free Tier */}
            <div className="dashboard-frame" style={{display: 'flex', flexDirection: 'column', textAlign: 'left', border: '1px solid var(--border-color)'}}>
              <h3 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Hobby</h3>
              <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem'}}>$0<span style={{fontSize: '1rem', color: 'var(--text-secondary)'}}>/mo</span></div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>Perfect for side projects and personal sites.</p>
              <ul style={{listStyle: 'none', padding: 0, margin: '0 0 2rem 0', color: 'var(--text-secondary)', flex: 1}}>
                <li style={{marginBottom: '0.8rem'}}>✓ Up to 2 Monitors</li>
                <li style={{marginBottom: '0.8rem'}}>✓ 10-minute intervals</li>
                <li style={{marginBottom: '0.8rem'}}>✓ 2 days log history</li>
                <li style={{marginBottom: '0.8rem'}}>✓ Community Support</li>
              </ul>
              <button className="pill-btn" style={{width: '100%', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)'}}>Current Plan</button>
            </div>
            
            {/* Pro Tier */}
            <div className="dashboard-frame" style={{display: 'flex', flexDirection: 'column', textAlign: 'left', border: '1px solid var(--accent)', position: 'relative'}}>
              <div style={{position: 'absolute', top: '-12px', right: '2rem', background: 'var(--accent)', color: '#000', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold'}}>MOST POPULAR</div>
              <h3 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Pro</h3>
              <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem'}}>$9<span style={{fontSize: '1rem', color: 'var(--text-secondary)'}}>/mo</span></div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>For production applications and businesses.</p>
              <ul style={{listStyle: 'none', padding: 0, margin: '0 0 2rem 0', color: 'var(--text-secondary)', flex: 1}}>
                <li style={{marginBottom: '0.8rem'}}>✓ Up to 25 Monitors</li>
                <li style={{marginBottom: '0.8rem'}}>✓ 5-minute intervals</li>
                <li style={{marginBottom: '0.8rem', color: 'var(--text-primary)'}}>✓ Discord & Slack Webhooks</li>
                <li style={{marginBottom: '0.8rem', color: 'var(--text-primary)'}}>✓ Email Alerts</li>
                <li style={{marginBottom: '0.8rem'}}>✓ 30 days log history</li>
              </ul>
              <button className="pill-btn" style={{width: '100%'}}>Upgrade to Pro</button>
            </div>

            {/* Enterprise Tier */}
            <div className="dashboard-frame" style={{display: 'flex', flexDirection: 'column', textAlign: 'left', border: '1px solid var(--border-color)'}}>
              <h3 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Enterprise</h3>
              <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem'}}>$49<span style={{fontSize: '1rem', color: 'var(--text-secondary)'}}>/mo</span></div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>For mission-critical global infrastructure.</p>
              <ul style={{listStyle: 'none', padding: 0, margin: '0 0 2rem 0', color: 'var(--text-secondary)', flex: 1}}>
                <li style={{marginBottom: '0.8rem'}}>✓ Unlimited Monitors</li>
                <li style={{marginBottom: '0.8rem'}}>✓ 30-second intervals</li>
                <li style={{marginBottom: '0.8rem', color: 'var(--text-primary)'}}>✓ SMS / Phone Call Alerts</li>
                <li style={{marginBottom: '0.8rem'}}>✓ Unlimited log history</li>
                <li style={{marginBottom: '0.8rem'}}>✓ 24/7 Dedicated Support</li>
              </ul>
              <button className="pill-btn" style={{width: '100%', background: 'var(--text-secondary)'}}>Contact Sales</button>
            </div>
          </div>
        </div>
      ) : selectedService ? (
        // --- DETAILS VIEW ---
        <div className="container" style={{marginTop: '2rem'}}>
          <div className="dashboard-frame">
            <div className="section-header">
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                <button onClick={() => setSelectedService(null)} className="icon-btn" style={{padding: '0.5rem', width: 'auto'}}>← Back</button>
                <h2>{selectedService.name} Details</h2>
              </div>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button onClick={() => handlePause(selectedService.id)} className="pill-btn" style={{background: 'var(--text-secondary)'}}>
                  {selectedService.is_active ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => handleDelete(selectedService.id)} className="pill-btn" style={{background: 'var(--danger)'}}>Delete</button>
              </div>
            </div>
            
            <div style={{padding: '1.5rem', borderBottom: '1px solid var(--border-color)'}}>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem'}}><strong>URL:</strong> {selectedService.url}</p>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem'}}><strong>Interval:</strong> Every {selectedService.interval_minutes} minutes</p>
              <p style={{color: 'var(--text-secondary)'}}><strong>Status:</strong> {selectedService.is_active ? '🟢 Active' : '⏸️ Paused'}</p>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', padding: '1.5rem'}}>
              <div>
                <h3 style={{marginBottom: '1rem', color: 'var(--text-primary)'}}>Future Scheduled Pings</h3>
                {selectedService.is_active ? (
                  <ul style={{listStyle: 'none', padding: 0, color: 'var(--text-secondary)'}}>
                    {getFuturePings(selectedService).map((time, i) => (
                      <li key={i} style={{padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)'}}>
                        🕒 {time}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{color: 'var(--text-secondary)'}}>Service is paused. No future pings scheduled.</p>
                )}
              </div>

              <div>
                <h3 style={{marginBottom: '1rem', color: 'var(--text-primary)'}}>Recent History</h3>
                <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                  {serviceHistory.length === 0 ? (
                    <p style={{color: 'var(--text-secondary)'}}>No history yet.</p>
                  ) : (
                    <ul style={{listStyle: 'none', padding: 0}}>
                      {serviceHistory.map((ping, i) => (
                        <li key={i} style={{padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between'}}>
                          <span style={{color: 'var(--text-secondary)'}}>{new Date(ping.timestamp).toLocaleTimeString()}</span>
                          <span style={{color: ping.is_success ? 'var(--success)' : 'var(--danger)'}}>
                            {ping.status_code} OK ({Math.round(ping.response_time_ms)}ms)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // --- MAIN DASHBOARD VIEW ---
        <>
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

            <div className="dashboard-frame">
              <div className="section-header">
                <h2>Monitoring Dashboard</h2>
              </div>
              
              <div className="services-grid">
                {services.length === 0 ? (
                  <p style={{color: 'var(--text-secondary)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem'}}>
                    Your dashboard is empty. Add a service above!
                  </p>
                ) : (
                  services.map(service => (
                    <div 
                      key={service.id} 
                      className="service-card" 
                      onClick={() => openDetails(service)}
                      style={{cursor: 'pointer', opacity: service.is_active ? 1 : 0.6}}
                    >
                      <div className="card-header">
                        <div className="card-title">
                          {service.name} 
                          {!service.is_active && <span style={{marginLeft: '0.5rem', fontSize: '0.7rem', background: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px'}}>PAUSED</span>}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Next: {getNextPingTime(service)}</span>
                      </div>
                      <div className="card-url">{service.url}</div>
                      
                      {service.latestPing ? (
                        <div className="ping-status">
                          <div className="ping-status-text" style={{ color: service.is_active ? (service.latestPing.is_success ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
                            <span className="status-dot" style={{ backgroundColor: service.is_active ? (service.latestPing.is_success ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}></span>
                            {service.latestPing.status_code} OK
                            <span style={{color: 'var(--text-primary)', marginLeft: 'auto', fontWeight: 'normal'}}>{Math.round(service.latestPing.response_time_ms)}ms</span>
                          </div>
                          <div className="ping-time">
                            Last checked {new Date(service.latestPing.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <div className="ping-status">
                          <div className="ping-status-text" style={{ color: 'var(--text-secondary)' }}>
                            <span className="status-dot" style={{ backgroundColor: 'var(--text-secondary)' }}></span>
                            {service.is_active ? 'Pending First Check...' : 'Paused'}
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
      )}
    </>
  )
}

export default App
