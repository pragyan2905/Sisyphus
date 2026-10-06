import { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function App() {
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({ name: '', url: '', interval_minutes: 5 });
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [token, setToken] = useState(null);
  
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
              onClick={() => { localStorage.removeItem('jwt_token'); setToken(null); setServices([]); setSelectedService(null); }}
            >
              Log out
            </button>
          ) : (
            <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/auth/login`} className="login-btn">Log in with Google</a>
          )}
          <button className="signup-btn">Get started free</button>
        </div>
      </nav>

      {selectedService ? (
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
                <button onClick={() => fetchServiceHistory(selectedService.id)} className="icon-btn" title="Refresh">↻</button>
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
                <button onClick={fetchServices} className="icon-btn" title="Refresh">↻</button>
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
