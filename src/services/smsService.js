import { fetchFromAPI } from './api';

export async function getSMSBalance() {
  try {
    const data = await fetchFromAPI('balance');
    return data.credits;
  } catch (error) {
    console.error('Error fetching SMS balance:', error);
    return 0;
  }
} 