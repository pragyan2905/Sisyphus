// Port 8080 matches the FastAPI uvicorn dev server we are running
const API_BASE_URL = 'http://localhost:8080';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Fetch data on load
    fetchServices();
    
    // 2. Attach Event Listeners
    document.getElementById('serviceForm').addEventListener('submit', handleAddService);
    document.getElementById('refreshBtn').addEventListener('click', fetchServices);
});

async function fetchServices() {
    try {
        // Vanilla Javascript fetch API talking to our FastAPI endpoint
        const response = await fetch(`${API_BASE_URL}/services`);
        if (!response.ok) throw new Error('Failed to fetch services');
        
        const services = await response.json();
        renderServices(services);
    } catch (error) {
        console.error('Error fetching services:', error);
    }
}

async function handleAddService(event) {
    // Prevent the form from refreshing the page
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button');
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;

    // Build the Pydantic-compatible JSON object
    const newService = {
        name: document.getElementById('name').value,
        url: document.getElementById('url').value,
        interval_minutes: parseInt(document.getElementById('interval').value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/services`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newService)
        });

        if (!response.ok) throw new Error('Failed to add service');
        
        // Clear the input fields
        event.target.reset();
        
        // Refresh the grid to show the new service
        await fetchServices();
    } catch (error) {
        console.error('Error adding service:', error);
        alert('Failed to connect to Backend. Is FastAPI running on port 8080?');
    } finally {
        submitBtn.textContent = 'Start Monitoring';
        submitBtn.disabled = false;
    }
}

function renderServices(services) {
    const grid = document.getElementById('servicesGrid');
    
    if (services.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1; padding: 2rem;">No services being monitored yet. Add one above!</p>';
        return;
    }

    // Map through the array and build HTML cards
    grid.innerHTML = services.map(service => `
        <div class="service-card">
            <div class="card-header">
                <div class="card-title">${escapeHTML(service.name)}</div>
                <div class="status-badge">${service.is_active ? 'ACTIVE' : 'PAUSED'}</div>
            </div>
            <div class="card-url">${escapeHTML(service.url)}</div>
            <div class="card-footer">
                <span>ID: #${service.id}</span>
                <span>Every ${service.interval_minutes}m</span>
            </div>
        </div>
    `).join('');
}

// Basic XSS protection to ensure malicious users can't inject scripts via the Name field
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
