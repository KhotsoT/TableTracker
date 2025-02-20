import { fetchFromAPI } from './api';

export const getSMSBalance = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/balance');
    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch balance');
    }
    
    return data.balance;
  } catch (error) {
    console.error('Error fetching SMS balance:', error);
    return 0;
  }
}; 