// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const connectBtn = document.getElementById('connect-btn');
const portSelect = document.getElementById('port-select');
const scanPortsBtn = document.getElementById('scan-ports-btn');
const ledOnBtn = document.getElementById('led-on-btn');
const ledOffBtn = document.getElementById('led-off-btn');
const ledVisual = document.getElementById('led-visual');
const responseContainer = document.getElementById('response-container');
const responseText = document.getElementById('response-text');
const messageContainer = document.getElementById('message-container');

// State
let isConnected = false;
let isLoading = false;
let availablePorts = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkStatus();
    loadPorts();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    connectBtn.addEventListener('click', connectToArduino);
    scanPortsBtn.addEventListener('click', loadPorts);
    ledOnBtn.addEventListener('click', () => controlLED('on'));
    ledOffBtn.addEventListener('click', () => controlLED('off'));
}

// Load available ports
async function loadPorts() {
    try {
        const response = await fetch('/ports');
        const data = await response.json();
        availablePorts = data.ports;
        
        // Update select dropdown
        portSelect.innerHTML = '';
        if (availablePorts.length === 0) {
            portSelect.innerHTML = '<option value="">No ports found</option>';
        } else {
            portSelect.innerHTML = '<option value="">Select a port...</option>';
            availablePorts.forEach(port => {
                const option = document.createElement('option');
                option.value = port.device;
                option.textContent = `${port.device} - ${port.description}`;
                portSelect.appendChild(option);
            });
        }
        
        console.log('Available ports:', availablePorts);
    } catch (error) {
        console.error('Error loading ports:', error);
        portSelect.innerHTML = '<option value="">Error loading ports</option>';
    }
}

// Check Arduino connection status
async function checkStatus() {
    try {
        const response = await fetch('/status');
        const data = await response.json();
        updateConnectionStatus(data.status === 'connected');
    } catch (error) {
        console.error('Error checking status:', error);
        updateConnectionStatus(false);
    }
}

// Update connection status UI
function updateConnectionStatus(connected) {
    isConnected = connected;
    
    if (connected) {
        statusIndicator.className = 'w-3 h-3 rounded-full status-connected';
        statusText.textContent = 'Connected to Arduino';
        connectBtn.textContent = 'Connected';
        connectBtn.disabled = true;
        connectBtn.className = 'w-full bg-green-500 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed';
        enableControlButtons(true);
    } else {
        statusIndicator.className = 'w-3 h-3 rounded-full status-disconnected';
        statusText.textContent = 'Not connected to Arduino';
        connectBtn.textContent = 'Connect to Arduino';
        connectBtn.disabled = false;
        connectBtn.className = 'w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200';
        enableControlButtons(false);
        updateLEDVisual(false);
    }
}

// Enable/disable control buttons
function enableControlButtons(enabled) {
    ledOnBtn.disabled = !enabled;
    ledOffBtn.disabled = !enabled;
    
    if (enabled) {
        ledOnBtn.className = 'bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105';
        ledOffBtn.className = 'bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105';
    } else {
        ledOnBtn.className = 'bg-gray-400 text-white font-medium py-3 px-6 rounded-lg cursor-not-allowed';
        ledOffBtn.className = 'bg-gray-400 text-white font-medium py-3 px-6 rounded-lg cursor-not-allowed';
    }
}

// Connect to Arduino
async function connectToArduino() {
    if (isLoading) return;
    
    const selectedPort = portSelect.value;
    if (!selectedPort) {
        showMessage('Please select a port first', 'error');
        return;
    }
    
    setLoading(connectBtn, true);
    
    try {
        const response = await fetch(`/connect/${selectedPort}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            showMessage(data.message, 'success');
            updateConnectionStatus(true);
        } else {
            showMessage(data.message, 'error');
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('Error connecting:', error);
        showMessage('Failed to connect to Arduino', 'error');
        updateConnectionStatus(false);
    } finally {
        setLoading(connectBtn, false);
    }
}

// Control LED
async function controlLED(state) {
    if (!isConnected || isLoading) return;
    
    const button = state === 'on' ? ledOnBtn : ledOffBtn;
    setLoading(button, true);
    
    try {
        const response = await fetch(`/led/${state}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            showMessage(data.message, 'success');
            updateLEDVisual(state === 'on');
            
            // Show Arduino response if available
            if (data.response) {
                responseText.textContent = data.response;
                responseContainer.classList.remove('hidden');
            }
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        console.error('Error controlling LED:', error);
        showMessage(`Failed to turn LED ${state}`, 'error');
    } finally {
        setLoading(button, false);
    }
}

// Update LED visual indicator
function updateLEDVisual(isOn) {
    if (isOn) {
        ledVisual.className = 'w-16 h-16 rounded-full border-4 border-gray-300 transition-all duration-300 led-on';
    } else {
        ledVisual.className = 'w-16 h-16 rounded-full border-4 border-gray-300 bg-gray-200 transition-all duration-300 led-off';
    }
}

// Set loading state for buttons
function setLoading(button, loading) {
    isLoading = loading;
    
    if (loading) {
        button.classList.add('btn-loading');
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        if (button === connectBtn && !isConnected) {
            button.disabled = false;
        } else if (button !== connectBtn && isConnected) {
            button.disabled = false;
        }
    }
}

// Show toast message
function showMessage(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    messageContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// Auto-refresh connection status every 5 seconds
setInterval(checkStatus, 5000);