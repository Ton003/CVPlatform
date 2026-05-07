import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkCounts() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    const tables = [
      'candidates',
      'employees',
      'applications',
      'cvs',
      'job_offers',
      'users'
    ];
    
    console.log('Current table counts:');
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`- ${table}: ${res.rows[0].count}`);
    }
  } catch (err) {
    console.error('Error checking counts:', err);
  } finally {
    await client.end();
  }
}

checkCounts();
