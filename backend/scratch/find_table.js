const { Client } = require('pg');

async function checkDb(dbName) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123123',
    database: dbName,
  });
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'business_units'");
    if (res.rows.length > 0) {
      console.log(`FOUND business_units in database: ${dbName}`);
      const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'job_roles'`);
      console.log(`Columns in job_roles:`, cols.rows.map(c => c.column_name).join(', '));
    } else {
      console.log(`business_units NOT FOUND in database: ${dbName}`);
    }
  } catch (err) {
    console.error(`Error checking ${dbName}:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  await checkDb('postgres');
  await checkDb('biat_cv_platform');
}

run();
