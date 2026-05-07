
import { Client } from 'pg';

async function activateMachacho() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Activating "machacho" role (case-insensitive)...');
  const res = await client.query(`
    UPDATE job_roles SET status = 'ACTIVE' WHERE name ILIKE 'machacho' RETURNING id, name, status
  `);

  if (res.rowCount > 0) {
    console.log('Successfully activated:');
    console.table(res.rows);
  } else {
    console.log('Role "machacho" not found even with ILIKE.');
    // List all roles names for debug
    const all = await client.query(`SELECT name FROM job_roles`);
    console.log('Available roles:', all.rows.map(r => `"${r.name}"`).join(', '));
  }

  await client.end();
}

activateMachacho().catch(console.error);
