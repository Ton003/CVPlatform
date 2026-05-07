
import { Client } from 'pg';

async function activateMachacho() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Activating "machacho" role...');
  const res = await client.query(`
    UPDATE job_roles SET status = 'ACTIVE' WHERE name = 'machacho' RETURNING id, name, status
  `);

  if (res.rowCount > 0) {
    console.log('Successfully activated:');
    console.table(res.rows);
  } else {
    console.log('Role "machacho" not found.');
  }

  await client.end();
}

activateMachacho().catch(console.error);
