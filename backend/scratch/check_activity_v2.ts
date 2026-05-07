
import { Client } from 'pg';

async function checkActivity() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Checking recent activity...');
  const res = await client.query(`
    SELECT action, description, created_at 
    FROM activity_log 
    ORDER BY created_at DESC 
    LIMIT 20
  `);

  console.table(res.rows);
  await client.end();
}

checkActivity().catch(console.error);
