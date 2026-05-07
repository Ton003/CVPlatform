
import { Client } from 'pg';

async function checkEmployee() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  const email = 'elyesderouiche@gmail.com';
  const res = await client.query('SELECT id, employee_id, first_name, last_name, email FROM employees WHERE email = $1', [email]);
  
  if (res.rows.length > 0) {
    console.log('Found existing employee:');
    console.table(res.rows);
  } else {
    console.log(`No employee found with email: ${email}`);
  }

  await client.end();
}

checkEmployee().catch(console.error);
