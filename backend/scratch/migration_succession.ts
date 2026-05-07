import { Client } from 'pg';

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  console.log('Adding succession & risk columns to employees table...');

  await client.query(`
    ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS succession_readiness VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS retention_risk VARCHAR(10) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS impact_of_loss VARCHAR(10) DEFAULT NULL
  `);

  console.log('✅ Migration complete: succession_readiness, retention_risk, impact_of_loss added.');

  await client.end();
}

migrate().catch(console.error);
