import { createConnection } from 'typeorm';
import { ScoutInsight } from '../src/intelligence/entities/scout-insight.entity';
import { Candidate } from '../src/candidates/entities/candidates.entity';
import { Employee } from '../src/employees/entities/employee.entity';
import { JobOffer } from '../src/job-offers/job-offer.entity';

async function checkInsights() {
  const connection = await createConnection({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: '123123',
    database: 'biat_cv_platform',
    entities: [ScoutInsight, Candidate, Employee, JobOffer],
  });

  const insightRepo = connection.getRepository(ScoutInsight);
  const allInsights = await insightRepo.find({ relations: ['candidate', 'job', 'employee'] });
  
  console.log(`\n📊 TOTAL INSIGHTS IN DB: ${allInsights.length}`);
  
  allInsights.forEach(i => {
    const subject = i.candidate ? `${i.candidate.first_name} ${i.candidate.last_name}` : 
                    i.employee ? `${i.employee.firstName} ${i.employee.lastName}` : 'Unknown';
    console.log(`- [${i.status}] ${i.type} | Subject: ${subject} | Score: ${i.score}% | Reasoning: ${i.reasoning?.substring(0, 50)}...`);
  });

  await connection.close();
}

checkInsights().catch(console.error);
