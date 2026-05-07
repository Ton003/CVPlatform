
import { Client } from 'pg';

async function checkRecent() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Checking roles created today...');
  const res = await client.query(`
    SELECT id, name, status, "createdAt" 
    FROM job_roles 
    WHERE "createdAt" > CURRENT_DATE
  `);

  console.table(res.rows);
  await client.end();
}

checkRecent().catch(console.error);
