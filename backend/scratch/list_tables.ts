
import { Client } from 'pg';

async function listTables() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log('Tables in biat_cv_platform:');
  console.log(res.rows.map(r => r.table_name).join(', '));
  await client.end();
}

listTables().catch(console.error);
