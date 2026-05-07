
import { Client } from 'pg';

async function checkMachachoLevel() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Searching for "machacho" role level...');
  const res = await client.query(`
    SELECT jrl.id, jrl.title, jr.name as role_name, jr.status 
    FROM job_role_levels jrl
    JOIN job_roles jr ON jr.id = jrl."jobRoleId"
    WHERE jrl.title ILIKE '%machacho%'
  `);

  console.table(res.rows);
  await client.end();
}

checkMachachoLevel().catch(console.error);
