
import { Client } from 'pg';

async function investigate() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('--- Applications ---');
  const apps = await client.query('SELECT id, stage, "candidateName" FROM applications');
  console.table(apps.rows);

  console.log('--- Job Roles ---');
  const roles = await client.query('SELECT id, name, status FROM job_roles');
  console.table(roles.rows);

  console.log('--- Job Role Levels ---');
  const levels = await client.query('SELECT id, "jobRoleId", title, "levelNumber" FROM job_role_levels');
  console.table(levels.rows);

  await client.end();
}

investigate().catch(console.error);
