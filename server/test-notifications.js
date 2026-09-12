// test-notifications.js — Test notifications API
require('dotenv').config();
const http = require('http');

const BASE = 'localhost';
const PORT = 5000;

const get = (path, token) => new Promise((resolve) => {
  const req = http.request({ hostname: BASE, port: PORT, path, method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: {} }); } });
  });
  req.on('error', e => resolve({ status: 0, error: e.message }));
  req.end();
});

const post = (path, body, token) => new Promise((resolve) => {
  const payload = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const req = http.request({ hostname: BASE, port: PORT, path, method: 'POST', headers }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: {} }); } });
  });
  req.on('error', e => resolve({ status: 0, error: e.message }));
  req.write(payload);
  req.end();
});

(async () => {
  console.log('\n=== HomeEase Notifications API Test ===\n');

  // Login as customer
  console.log('Step 1: Customer Login...');
  const customerLogin = await post('/api/auth/login', { email: 'customer@demo.com', password: 'password123' });
  if (customerLogin.status !== 200) {
    console.log('❌ Customer login failed:', customerLogin.status, customerLogin.body?.message);
    process.exit(1);
  }
  const customerToken = customerLogin.body.accessToken;
  console.log('✅ Customer login OK\n');

  // Test notification endpoints
  const tests = [
    { path: '/api/notifications', name: 'Get Customer Notifications', token: customerToken },
  ];

  let passed = 0;
  for (const test of tests) {
    console.log(`Testing ${test.name}...`);
    let result;
    if (test.method === 'POST') {
      result = await post(test.path, test.body, test.token);
    } else {
      result = await get(test.path, test.token);
    }
    const ok = result.status === 200 || result.status === 201;
    if (ok) passed++;
    const count = result.body.data?.notifications?.length || result.body.data?.notification ? 'YES' : 'NO';
    console.log(`${ok ? '✅' : '❌'} ${test.name}: HTTP ${result.status} | data: ${count}`);
    if (!ok) console.log(`   Error: ${result.body?.message || result.error}`);
  }

  console.log(`\n=== RESULT: ${passed}/${tests.length} notification tests PASSED ===\n`);
  process.exit(passed === tests.length ? 0 : 1);
})();
