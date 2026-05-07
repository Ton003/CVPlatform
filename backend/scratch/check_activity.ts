
import { Client } from 'pg';

async function checkActivity() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Checking recent activity...');
  const res = await client.query(`
    SELECT action, description, "createdAt" 
    FROM activity_log 
    ORDER BY "createdAt" DESC 
    LIMIT 10
  `);

  console.table(res.rows);
  await client.end();
}

checkActivity().catch(console.error);
