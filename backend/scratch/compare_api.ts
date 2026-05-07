
import axios from 'axios';

async function fetchDirect() {
  try {
    const res = await axios.get('http://localhost:3000/api/job-architecture/tree');
    console.log('Direct 3000:', JSON.stringify(res.data, null, 2).includes('machacho') ? 'FOUND' : 'NOT FOUND');
    
    const res80 = await axios.get('http://localhost/api/job-architecture/tree');
    console.log('Proxy 80:', JSON.stringify(res80.data, null, 2).includes('machacho') ? 'FOUND' : 'NOT FOUND');
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

fetchDirect();
