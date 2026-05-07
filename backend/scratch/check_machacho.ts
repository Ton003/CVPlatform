
import { Client } from 'pg';

async function checkMachacho() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Searching for "machacho" role...');
  const res = await client.query(`
    SELECT id, name, status FROM job_roles WHERE name ILIKE '%machacho%'
  `);

  console.table(res.rows);
  await client.end();
}

checkMachacho().catch(console.error);
