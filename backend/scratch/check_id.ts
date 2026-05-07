
import { Client } from 'pg';

async function checkId() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Searching for ID dc3d568c-3f68-46b3-999f-faf1a76c6cb8...');
  const res = await client.query(`SELECT * FROM job_roles WHERE id = 'dc3d568c-3f68-46b3-999f-faf1a76c6cb8'`);
  console.table(res.rows);

  await client.end();
}

checkId().catch(console.error);
