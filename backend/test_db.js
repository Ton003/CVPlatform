const { Client } = require('pg');
const client = new Client('postgres://postgres:123123@localhost:5432/biat_cv_platform');
client.connect().then(async () => {
  try {
    const user = await client.query('SELECT * FROM users LIMIT 1');
    const lv = await client.query('SELECT * FROM job_role_levels LIMIT 1');
    
    // Using parameter arrays to test stringified JSON
    const res = await client.query(`
      INSERT INTO job_offers (
        job_role_level_id, title, description,
        contract_type, work_mode, salary_min, salary_max, currency,
        openings_count, hiring_manager, deadline, visibility,
        snapshot, status, created_by, scoring_weights, email_settings
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16::jsonb, $17::jsonb)
      RETURNING *`, [
      lv.rows[0].id,
      'Test Job',
      'Desc',
      'CDI',
      'Hybrid',
      null,
      null,
      'TND',
      1,
      null,
      null,
      'both',
      JSON.stringify({ test: 1 }),
      'open',
      user.rows[0].id,
      JSON.stringify({ technical: 25, competency: 25, interview: 25, managerial: 25 }),
      JSON.stringify({})
    ]);
    console.log('Insert Result:', res.rows[0]);
  } catch (e) {
    console.error('DB ERROR:', e);
  }
  client.end();
});
