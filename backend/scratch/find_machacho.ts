
import axios from 'axios';

async function findMachacho() {
  try {
    const res = await axios.get('http://localhost/api/job-architecture/tree');
    const bus = res.data;
    for (const bu of bus) {
      for (const dept of bu.departments || []) {
        for (const role of dept.jobRoles || []) {
          if (role.name.toLowerCase().includes('machacho')) {
            console.log('Role found:', JSON.stringify(role, null, 2));
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

findMachacho();
