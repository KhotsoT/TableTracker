const API_BASE = import.meta.env.NODE_ENV === 'production' 
  ? '/api'  // Production API path
  : 'http://localhost:3000/api'; // Development proxy

export async function fetchFromAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  return response.json();
} 