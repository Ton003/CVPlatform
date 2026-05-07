
import { Client } from 'pg';

async function checkCompetencies() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Searching "machacho" in competencies...');
  const res = await client.query(`SELECT * FROM competencies WHERE name ILIKE '%machacho%'`);
  console.table(res.rows);

  await client.end();
}

checkCompetencies().catch(console.error);
