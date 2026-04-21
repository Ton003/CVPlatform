/**
 * SFIA Competency Seed Script (Corrected for CVPlatform Backend)
 * 
 * Usage:
 *   $env:BASE_URL="http://localhost:3000"; $env:TOKEN="your_jwt"; node seed-sfia.js
 */

const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOKEN    = process.env.TOKEN    || '';

const data = JSON.parse(fs.readFileSync('./sfia-seed.json', 'utf8'));

const headers = {
  'Content-Type': 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function request(path, method, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function seed() {
  console.log(`\n🌱  Seeding ${data.families.length} families into ${BASE_URL}\n`);

  for (const family of data.families) {
    process.stdout.write(`  ▸ Family: ${family.name} (${family.category}) ... `);

    // 1. Create family
    let createdFamily;
    try {
      createdFamily = await request('/api/families', 'POST', {
        name:     family.name,
        category: family.category,
      });
      console.log(`✓ (id: ${createdFamily.id})`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
      continue;
    }

    // 2. Create each competence inside the family
    for (const comp of family.competences) {
      process.stdout.write(`      • Competence: ${comp.name} ... `);

      let createdComp;
      try {
        createdComp = await request('/api/competences', 'POST', {
          name:        comp.name,
          description: comp.description,
          familyId:    createdFamily.id,
        });
        console.log(`✓ (id: ${createdComp.id})`);
      } catch (e) {
        console.log(`✗ ${e.message}`);
        continue;
      }

      // 3. Set proficiency levels
      process.stdout.write(`        ↳ Levels ... `);
      try {
        // Backend expects PUT /api/competences/:id/levels with { levels: [...] }
        await request(`/api/competences/${createdComp.id}/levels`, 'PUT', { levels: comp.levels });
        console.log('✓');
      } catch (e) {
        console.log(`✗ ${e.message}`);
      }
    }
  }

  console.log('\n✅  Seed complete.\n');
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
