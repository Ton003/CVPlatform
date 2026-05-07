
import { Client } from 'pg';

async function checkTable(tableName: string) {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);

  console.log(`Columns in ${tableName}:`);
  console.table(res.rows);
  await client.end();
}

async function run() {
  await checkTable('competencies');
  await checkTable('competences');
}

run().catch(console.error);
