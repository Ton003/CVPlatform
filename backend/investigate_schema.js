const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres:123123@localhost:5432/biat_cv_platform'
});

async function check() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'job_offers'
      ORDER BY ordinal_position;
    `);
    console.log('Columns:');
    res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type} (null: ${r.is_nullable})`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
