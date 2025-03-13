import { fetchFromAPI } from './api';
import API_BASE_URL from '../config/api';

export const getSMSBalance = async () => {
  try {
    console.log('Fetching SMS balance from:', `${API_BASE_URL}/balance`);
    const response = await fetch(`${API_BASE_URL}/balance`);
    
    console.log('Balance response status:', response.status);
    const data = await response.json();
    console.log('Balance response data:', data);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status} - ${JSON.stringify(data)}`);
    }
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch balance');
    }
    
    return data.balance;
  } catch (error) {
    console.error('Error fetching SMS balance:', error);
    return 0;
  }
}; 