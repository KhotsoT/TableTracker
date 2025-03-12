const API_BASE_URL = import.meta.env.PROD 
  ? 'https://schoolconnect-server.onrender.com/api'  // Production URL (update this with your Render.com URL)
  : 'http://localhost:3000/api'; // Development URL

export default API_BASE_URL; 