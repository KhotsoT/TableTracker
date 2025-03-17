const isDevelopment = import.meta.env.MODE === 'development';
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5173/api'
  : 'https://schoolconnect-server.onrender.com/api';

console.log('API Base URL:', API_BASE_URL); // For debugging
export default API_BASE_URL; 