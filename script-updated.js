/**
 * Updated Main Script with Backend Integration
 * This script integrates with the backend services for authentication, Ollama, and data synchronization
 */

// Import backend services
const AuthService = require('./backend/auth-service.js');
const OllamaService = require('./backend/ollama-service.js');
const DataService = require('./backend/data-service.js');

// Initialize services
const ollamaService = new OllamaService();

// Global variables
let currentUser = null;
let currentToken = null;

// --- Authentication Functions ---
async function login(username, password) {
  try {
    // Call backend authentication
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.token) {
      // Store token in localStorage
      localStorage.setItem('token', data.token);
      currentUser = data.user;
      currentToken = data.token;

      // Show private section
      showPrivateSection();
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error || 'Login failed' };
    }
  } catch (error) {
    return { success: false, error: 'Network error during login' };
  }
}

async function register(username, password, displayName) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password, displayName })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Network error during registration' };
  }
}

async function logout() {
  // Clear local storage
  localStorage.removeItem('token');
  currentUser = null;
  currentToken = null;

  // Show login section
  showLoginSection();
}

// --- Data Synchronization Functions ---
async function saveUserData(key, data) {
  try {
    const response = await fetch('/api/data/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ key, data })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: 'Network error saving data' };
  }
}

async function loadUserData(key) {
  try {
    const response = await fetch(`/api/data/load/${key}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: 'Network error loading data' };
  }
}

// --- Ollama Integration ---
async function generateText(prompt, model = 'llama3.2:latest') {
  try {
    const response = await fetch('/api/ollama/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ prompt, model })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: 'Network error generating text' };
  }
}

async function checkOllamaStatus() {
  try {
    const response = await fetch('/api/ollama/status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: 'Network error checking Ollama status' };
  }
}

// --- UI Functions ---
function showPrivateSection() {
  document.querySelector('.welcome-section').style.display = 'none';
  document.querySelector('.login-section').style.display = 'none';
  document.querySelector('.website-link-section').style.display = 'none';
  document.querySelector('.private-files-section').style.display = 'block';

  // Initialize utility tracker if available
  const utilityTracker = document.getElementById('utility-tracker');
  if (utilityTracker && typeof window.UtilityTracker !== 'undefined') {
    utilityTracker.style.display = 'block';
    window.UtilityTracker.updateTracker();
  }

  // Load user data
  loadUserData('notes').then(result => {
    if (result.data) {
      // Update notes display
      updateNotesDisplay(result.data);
    }
  });
}

function showLoginSection() {
  document.querySelector('.welcome-section').style.display = 'block';
  document.querySelector('.login-section').style.display = 'block';
  document.querySelector('.website-link-section').style.display = 'block';
  document.querySelector('.private-files-section').style.display = 'none';

  const utilityTracker = document.getElementById('utility-tracker');
  if (utilityTracker) {
    utilityTracker.style.display = 'none';
  }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing token
  const token = localStorage.getItem('token');
  if (token) {
    // Verify token
    verifyToken(token).then(result => {
      if (result.valid) {
        currentUser = result.user;
        currentToken = token;
        showPrivateSection();
      }
    });
  }

  // Login form event listener
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const username = usernameInput ? usernameInput.value : '';
    const password = passwordInput ? passwordInput.value : '';

    const result = await login(username, password);

    if (result.success) {
      loginMessage.textContent = 'Anmeldung erfolgreich!';
      loginMessage.className = 'message success';
    } else {
      loginMessage.textContent = result.error || 'Ungültiger Benutzername oder Passwort.';
      loginMessage.className = 'message error';
    }
  });

  // Logout button
  const logoutButton = document.getElementById('logoutButton');
  logoutButton.addEventListener('click', logout);

  // Initialize other UI components
  initializeUI();
});

// --- Helper Functions ---
async function verifyToken(token) {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { valid: false, error: 'Token verification failed' };
  }
}

function initializeUI() {
  // Initialize the WebGL background animation (existing code)
  // ... [existing WebGL code remains unchanged] ...
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    login,
    logout,
    register,
    saveUserData,
    loadUserData,
    generateText,
    checkOllamaStatus
  };
}