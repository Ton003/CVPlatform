import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listDatabases() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // connect to default db to list others
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT datname FROM pg_database WHERE datistemplate = false;`);
    console.log('Databases:', res.rows.map(r => r.datname));
  } catch (err) {
    console.error('Error listing databases:', err);
  } finally {
    await client.end();
  }
}

listDatabases();
