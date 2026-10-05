import { useState, useEffect } from 'react'
import './index.css'

const API_BASE_URL = 'http://localhost:8080';

function App() {
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({ name: '', url: '', interval_minutes: 5 });
  const [loading, setLoading] = useState(false);

  const fetchServices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/services`);
      if (res.ok) {
        const data = await res.json();
        
        // Phase 15: Fetch ping history for every service to display observability stats
        const servicesWithHistory = await Promise.all(data.map(async (service) => {
          try {
            const histRes = await fetch(`${API_BASE_URL}/services/${service.id}/history`);
            let latestPing = null;
            if (histRes.ok) {
              const history = await histRes.json();
              if (history.length > 0) {
                latestPing = history[0]; // The 0th item is the most recent due to our SQL order_by desc
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
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({ name: '', url: '', interval_minutes: 5 });
        fetchServices();
      } else {
        alert('Failed to add service');
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="background-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <header className="glass-panel">
        <div className="logo">
          <div className="pulse-dot"></div>
          <h1>Keep-Alive</h1>
        </div>
        <p>Monitor your services with zero cold starts.</p>
      </header>

      <main>
        <section className="glass-panel add-service-section">
          <h2>Add New Service</h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Service Name</label>
              <input 
                type="text" 
                placeholder="e.g. Production API" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>Target URL</label>
              <input 
                type="url" 
                placeholder="https://api.example.com" 
                required 
                value={formData.url}
                onChange={e => setFormData({...formData, url: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>Interval (Minutes)</label>
              <input 
                type="number" 
                min="1" 
                required 
                value={formData.interval_minutes}
                onChange={e => setFormData({...formData, interval_minutes: parseInt(e.target.value) || 1})}
              />
            </div>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Adding...' : 'Start Monitoring'}
            </button>
          </form>
        </section>

        <section className="glass-panel services-list-section">
          <div className="section-header">
            <h2>Active Services</h2>
            <button onClick={fetchServices} className="icon-btn" title="Refresh" type="button">↻</button>
          </div>
          
          <div className="services-grid">
            {services.length === 0 ? (
              <p style={{color: 'var(--text-secondary)', textAlign: 'center', gridColumn: '1/-1', padding: '2rem'}}>No services added yet.</p>
            ) : (
              services.map(service => (
                <div key={service.id} className="service-card">
                  <div className="card-header">
                    <div className="card-title">{service.name}</div>
                    <div className="status-badge">{service.is_active ? 'ACTIVE' : 'PAUSED'}</div>
                  </div>
                  <div className="card-url">{service.url}</div>
                  
                  {/* Observability Section */}
                  {service.latestPing && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: service.latestPing.is_success ? 'var(--success)' : '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: service.latestPing.is_success ? 'var(--success)' : '#ef4444' }}></span>
                        {service.latestPing.status_code} OK ({Math.round(service.latestPing.response_time_ms)}ms)
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginLeft: '1rem' }}>
                        Checked: {new Date(service.latestPing.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  )}

                  <div className="card-footer">
                    <span>ID: #{service.id}</span>
                    <span>Every {service.interval_minutes}m</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
