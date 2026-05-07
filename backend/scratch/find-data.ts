import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function findData() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables with data:');
    for (const row of tablesRes.rows) {
      const countRes = await client.query(`SELECT COUNT(*) FROM ${row.table_name}`);
      const count = parseInt(countRes.rows[0].count);
      if (count > 0) {
        console.log(`- ${row.table_name}: ${count}`);
      }
    }
  } catch (err) {
    console.error('Error finding data:', err);
  } finally {
    await client.end();
  }
}

findData();
