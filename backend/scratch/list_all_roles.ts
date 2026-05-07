
import { Client } from 'pg';

async function listAllRoles() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Listing ALL job roles...');
  const res = await client.query(`SELECT id, name, status FROM job_roles`);
  console.table(res.rows);

  await client.end();
}

listAllRoles().catch(console.error);
