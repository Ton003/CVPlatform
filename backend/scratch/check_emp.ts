import { DataSource } from 'typeorm';
import { dbConfig } from '../src/database/database.config';

async function check() {
  const ds = new DataSource(dbConfig);
  await ds.initialize();
  const res = await ds.query(`
    SELECT e.id, e.firstName, e.lastName, jrl.title as level_title, jrl."levelNumber"
    FROM employees e
    JOIN job_role_levels jrl ON e.job_role_level_id = jrl.id
    WHERE e.id = 'c875fa3b-dabb-4750-965a-6e1bc892a3bb'
  `);
  console.log('Employee state in DB:', res);
  process.exit(0);
}

check();
