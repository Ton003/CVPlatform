
import { Client } from 'pg';

async function listRoles() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Listing all job roles...');
  const res = await client.query(`SELECT id, name, status FROM job_roles ORDER BY created_at DESC LIMIT 10`);
  console.table(res.rows);

  await client.end();
}

listRoles().catch(console.error);
