
import { Client } from 'pg';

async function checkEmployees() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Searching for "machacho" in employees...');
  const res = await client.query(`
    SELECT e.id, e.first_name, e.last_name, jr.name as current_role
    FROM employees e
    LEFT JOIN job_roles jr ON jr.id = e.job_role_id
    WHERE e.first_name ILIKE '%machacho%' OR e.last_name ILIKE '%machacho%'
  `);

  console.table(res.rows);
  await client.end();
}

checkEmployees().catch(console.error);
