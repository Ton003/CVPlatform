import { DataSource } from 'typeorm';
import { dbConfig } from '../src/database/database.config';

async function sync() {
  const ds = new DataSource(dbConfig);
  await ds.initialize();
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "employee_history" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "employee_id" uuid NOT NULL,
      "eventType" varchar NOT NULL DEFAULT 'other',
      "effectiveDate" date NOT NULL,
      "notes" text,
      "old_role_level_id" uuid,
      "old_department_id" uuid,
      "new_role_level_id" uuid,
      "new_department_id" uuid,
      "recorded_by" varchar,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_employee_history" PRIMARY KEY ("id")
    )
  `);
  console.log('Table employee_history created');
  process.exit(0);
}

sync();
