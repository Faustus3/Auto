# Integration Guide

This guide explains how to integrate the Auto backend infrastructure with your frontend applications.

## Frontend Integration

### Authentication Integration

The frontend needs to handle JWT tokens for authentication. Here's how to integrate:

1. **Login Request**:
```javascript
// Login with username and password
const login = async (username, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  if (data.token) {
    // Store token in localStorage or sessionStorage
    localStorage.setItem('token', data.token);
    return data;
  }

  throw new Error(data.error || 'Login failed');
};
```

2. **Protected Requests**:
```javascript
// Make authenticated requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const finalOptions = { ...defaultOptions, ...options };

  const response = await fetch(`/api${endpoint}`, finalOptions);
  return response.json();
};
```

3. **Logout**:
```javascript
const logout = () => {
  localStorage.removeItem('token');
  // Redirect to login page
  window.location.href = '/login';
};
```

### Ollama Integration

To use the Ollama proxy, make requests to the backend endpoints:

```javascript
// Generate text using Ollama
const generateText = async (prompt, model = 'llama3.2:latest') => {
  const response = await apiRequest('/ollama/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, model })
  });

  return response;
};

// Check Ollama status
const checkOllamaStatus = async () => {
  const response = await apiRequest('/ollama/status');
  return response;
};
```

### Data Synchronization

For saving and loading user data:

```javascript
// Save user data
const saveUserData = async (key, data) => {
  const response = await apiRequest('/data/save', {
    method: 'POST',
    body: JSON.stringify({ key, data })
  });

  return response;
};

// Load user data
const loadUserData = async (key) => {
  const response = await apiRequest(`/data/load/${key}`);
  return response;
};

// List data keys
const listDataKeys = async () => {
  const response = await apiRequest('/data/keys');
  return response;
};
```

## API Endpoints Reference

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/register` - Register new user
- `GET /api/auth/verify` - Verify JWT token

### Ollama Proxy
- `POST /api/ollama/generate` - Generate text using Ollama
- `GET /api/ollama/status` - Check Ollama availability

### Data Sync
- `POST /api/data/save` - Save user data
- `GET /api/data/load/:key` - Load user data
- `GET /api/data/keys` - List user data keys

### Health Check
- `GET /health` - Server health status

## CORS Configuration

The backend is configured to allow requests from:
- `http://localhost:8080`
- `https://sohaltweil.github.io`

To add more origins, set the `ALLOWED_ORIGINS` environment variable:

```
ALLOWED_ORIGINS=http://localhost:8080,https://sohaltweil.github.io,https://yourdomain.com
```

## Error Handling

All API endpoints return consistent error responses:

```javascript
// Error response format
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

## Rate Limiting

The backend implements rate limiting:
- API requests: 100 requests per 15 minutes per IP
- Ollama requests: 20 requests per minute per user

## Security Best Practices

1. **Token Storage**: Store JWT tokens securely (localStorage/sessionStorage)
2. **HTTPS**: Always use HTTPS in production
3. **Input Validation**: All endpoints validate input data
4. **Environment Variables**: Never commit secrets to version control
5. **Regular Updates**: Keep dependencies updated

## Testing

### Unit Tests
The backend includes basic unit tests for authentication and data endpoints.

### Integration Tests
To test the full integration:

1. Start the server
2. Login with test credentials (`finn`/`test` or `dani`/`test`)
3. Make authenticated requests to all endpoints
4. Verify data persistence and synchronization

### Example Test Script
```javascript
// test-integration.js
const testAuth = async () => {
  // Test login
  const loginResponse = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'finn', password: 'test' })
  });

  const { token } = await loginResponse.json();
  console.log('Login successful:', !!token);

  // Test protected endpoint
  const verifyResponse = await fetch('/api/auth/verify', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const verifyData = await verifyResponse.json();
  console.log('Verification successful:', verifyData.valid);
};
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `ALLOWED_ORIGINS` includes your frontend domain
2. **Authentication Failures**: Check JWT_SECRET and credentials
3. **Ollama Connection**: Verify Ollama is running and accessible
4. **Rate Limiting**: Wait before making too many requests

### Debugging Tips

1. Check server logs for detailed error messages
2. Use browser developer tools to inspect API responses
3. Verify environment variables are set correctly
4. Test endpoints individually using curl or Postman