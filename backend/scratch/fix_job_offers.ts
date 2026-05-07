
import { Client } from 'pg';

async function fixJobOffer() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Fixing job_role_id in job_offers...');
  
  // Find offers with missing job_role_id but present job_role_level_id
  const res = await client.query(`
    SELECT jo.id, jo.job_role_level_id, jrl."jobRoleId"
    FROM job_offers jo
    JOIN job_role_levels jrl ON jo.job_role_level_id = jrl.id
    WHERE jo.job_role_id IS NULL
  `);

  console.log(`Found ${res.rowCount} offers to fix.`);
  
  for (const row of res.rows) {
    console.log(`Updating offer ${row.id} with jobRoleId ${row.jobRoleId}`);
    await client.query(`
      UPDATE job_offers SET job_role_id = $1 WHERE id = $2
    `, [row.jobRoleId, row.id]);
  }

  await client.end();
}

fixJobOffer().catch(console.error);
