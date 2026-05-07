
import { Client } from 'pg';

async function checkEverything() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Searching "machacho" in departments...');
  const resDept = await client.query(`SELECT * FROM departments WHERE name ILIKE '%machacho%'`);
  console.table(resDept.rows);

  console.log('Searching "machacho" in business_units...');
  const resBU = await client.query(`SELECT * FROM business_units WHERE name ILIKE '%machacho%'`);
  console.table(resBU.rows);

  await client.end();
}

checkEverything().catch(console.error);
