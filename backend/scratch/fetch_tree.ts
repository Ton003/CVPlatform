
import axios from 'axios';

async function fetchTree() {
  try {
    const res = await axios.get('http://localhost/api/job-architecture/tree');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

fetchTree();
