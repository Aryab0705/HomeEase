// test-providers.js — Test provider filtering API
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

const post = (path, body) => new Promise((resolve) => {
  const payload = JSON.stringify(body);
  const req = http.request({ hostname: BASE, port: PORT, path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: {} }); } });
  });
  req.on('error', e => resolve({ status: 0, error: e.message }));
  req.write(payload);
  req.end();
});

(async () => {
  console.log('\n=== HomeEase Provider Filtering Test ===\n');

  // Login as customer first
  console.log('Step 1: Customer Login...');
  const login = await post('/api/auth/login', { email: 'customer@demo.com', password: 'password123' });
  if (login.status !== 200) {
    console.log('❌ Customer login failed:', login.status, login.body?.message);
    process.exit(1);
  }
  const token = login.body.accessToken;
  console.log('✅ Customer login OK\n');

  // Test provider endpoints
  const tests = [
    { path: '/api/providers', name: 'All Providers' },
    { path: '/api/providers?category=Plumbing', name: 'Plumbing Providers' },
    { path: '/api/providers?category=Electrician', name: 'Electrician Providers' },
    { path: '/api/providers?category=Cleaning', name: 'Cleaning Providers' },
    { path: '/api/providers?verificationStatus=verified', name: 'Verified Providers' },
  ];

  let passed = 0;
  for (const test of tests) {
    console.log(`Testing ${test.name}...`);
    const result = await get(test.path, token);
    const ok = result.status === 200;
    if (ok) passed++;
    const count = result.body.data?.providers?.length || 0;
    const providerDetails = result.body.data?.providers?.map(p => `${p.userId?.name} (primary: ${p.primaryCategory})`).join(', ') || 'none';
    console.log(`${ok ? '✅' : '❌'} ${test.name}: HTTP ${result.status} | count: ${count}`);
    console.log(`   Providers: ${providerDetails}`);
    if (!ok) console.log(`   Error: ${result.body?.message || result.error}`);
  }

  console.log(`\n=== RESULT: ${passed}/${tests.length} provider tests PASSED ===\n`);
  process.exit(passed === tests.length ? 0 : 1);
})();
