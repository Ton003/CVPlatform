import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function verify() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT * FROM candidates LIMIT 5;`);
    console.log('Candidates rows:', res.rows.length);
    if (res.rows.length > 0) {
      console.log('Sample candidate:', res.rows[0]);
    }
  } catch (err) {
    console.error('Error verifying candidates:', err);
  } finally {
    await client.end();
  }
}

verify();
