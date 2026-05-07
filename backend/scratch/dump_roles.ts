
import { Client } from 'pg';

async function dumpRoles() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  const res = await client.query(`SELECT * FROM job_roles`);
  console.log(`Found ${res.rowCount} roles.`);
  res.rows.forEach(r => console.log(`- ${r.name} (${r.status}) [${r.id}]`));

  await client.end();
}

dumpRoles().catch(console.error);
