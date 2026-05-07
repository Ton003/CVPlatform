
import { Client } from 'pg';

async function testDelete() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123123@localhost:5432/biat_cv_platform'
  });
  await client.connect();

  const id = '5140c841-a793-4e08-94a2-b20e1c729796';
  console.log(`Attempting to delete candidate ${id}...`);

  try {
    // Mimic the logic in CandidatesController
    await client.query('BEGIN');
    
    console.log('Deleting from cvs...');
    await client.query('DELETE FROM cvs WHERE candidate_id = $1', [id]);
    
    console.log('Deleting from candidate_competencies...');
    await client.query('DELETE FROM candidate_competencies WHERE candidate_id = $1', [id]);
    
    console.log('Deleting from candidate_career_entries...');
    await client.query('DELETE FROM candidate_career_entries WHERE candidate_id = $1', [id]);
    
    console.log('Deleting from candidates...');
    await client.query('DELETE FROM candidates WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    console.log('Delete successful!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Delete failed:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
  } finally {
    await client.end();
  }
}

testDelete().catch(console.error);
