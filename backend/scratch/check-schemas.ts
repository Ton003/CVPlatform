import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkSchemas() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT schema_name FROM information_schema.schemata;`);
    console.log('Schemas:', res.rows.map(r => r.schema_name));
  } catch (err) {
    console.error('Error checking schemas:', err);
  } finally {
    await client.end();
  }
}

checkSchemas();
