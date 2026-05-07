
import { Client } from 'pg';

async function checkDb() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  const res = await client.query(`SELECT current_database(), current_user`);
  console.table(res.rows);

  const resTables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  console.log('Tables:', resTables.rows.map(r => r.table_name).join(', '));

  await client.end();
}

checkDb().catch(console.error);
