
import { Client } from 'pg';

async function listEmployees() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  const res = await client.query('SELECT count(*) FROM employees');
  console.log(`Total employees: ${res.rows[0].count}`);

  const resEmails = await client.query('SELECT email FROM employees LIMIT 10');
  console.log('Sample emails:');
  console.table(resEmails.rows);

  await client.end();
}

listEmployees().catch(console.error);
