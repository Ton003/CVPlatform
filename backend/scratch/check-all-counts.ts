import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkAllTables() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Table counts:');
    for (const row of res.rows) {
      const countRes = await client.query(`SELECT COUNT(*) FROM ${row.table_name}`);
      console.log(`- ${row.table_name}: ${countRes.rows[0].count}`);
    }
  } catch (err) {
    console.error('Error checking counts:', err);
  } finally {
    await client.end();
  }
}

checkAllTables();
