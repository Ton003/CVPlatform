
import { Client } from 'pg';

async function findEverywhere() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/postgres'
  });
  await client.connect();

  const dbs = await client.query(`SELECT datname FROM pg_database WHERE datistemplate = false`);
  for (const db of dbs.rows) {
    const dbName = db.datname;
    console.log(`Checking database: ${dbName}...`);
    const dbClient = new Client({
      connectionString: `postgresql://postgres:123123@localhost:5432/${dbName}`
    });
    try {
      await dbClient.connect();
      const res = await dbClient.query(`
        SELECT count(*) FROM information_schema.tables WHERE table_name = 'job_roles'
      `);
      if (res.rows[0].count > 0) {
        const roles = await dbClient.query(`SELECT name FROM job_roles WHERE name ILIKE '%machacho%'`);
        if (roles.rowCount > 0) {
          console.log(`FOUND IN DB: ${dbName}`);
          console.table(roles.rows);
        }
      }
      await dbClient.end();
    } catch (err) {
      console.error(`Error connecting to ${dbName}`);
    }
  }
  await client.end();
}

findEverywhere().catch(console.error);
