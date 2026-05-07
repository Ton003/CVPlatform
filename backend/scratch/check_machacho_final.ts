
import { Client } from 'pg';

async function checkMachachoFinal() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Searching for "machacho" in roles...');
  const resRoles = await client.query(`SELECT * FROM job_roles WHERE name ILIKE '%machacho%'`);
  console.table(resRoles.rows);

  console.log('Searching for "machacho" in levels...');
  const resLevels = await client.query(`SELECT * FROM job_role_levels WHERE title ILIKE '%machacho%'`);
  console.table(resLevels.rows);

  await client.end();
}

checkMachachoFinal().catch(console.error);
