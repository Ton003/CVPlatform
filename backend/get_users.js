const { Client } = require('pg');
const client = new Client('postgres://postgres:123123@localhost:5432/biat_cv_platform');
client.connect().then(async () => {
  const res = await client.query('SELECT * FROM users LIMIT 1');
  console.log('User:', res.rows[0]);
  client.end();
});
