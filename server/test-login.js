// test-login.js — Test login for all roles
require('dotenv').config();
const http = require('http');

const BASE = 'localhost';
const PORT = 5000;

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
  console.log('\n=== HomeEase Login Test ===\n');

  const tests = [
    { name: 'Customer Login', email: 'customer@demo.com', password: 'password123' },
    { name: 'Provider Login', email: 'provider@demo.com', password: 'password123' },
    { name: 'Admin Login', email: 'admin@demo.com', password: 'password123' },
    { name: 'Super Admin Login', email: 'superadmin@homeease.com', password: 'password123' },
  ];

  let passed = 0;
  for (const test of tests) {
    console.log(`Testing ${test.name}...`);
    const result = await post('/api/auth/login', { email: test.email, password: test.password });
    const ok = result.status === 200;
    if (ok) passed++;
    console.log(`${ok ? '✅' : '❌'} ${test.name}: HTTP ${result.status} | role: ${result.body.user?.role || 'N/A'} | token: ${result.body.accessToken ? 'YES' : 'NO'}`);
    if (!ok) console.log(`   Error: ${result.body?.message || result.error}`);
  }

  console.log(`\n=== RESULT: ${passed}/${tests.length} logins PASSED ===\n`);
  process.exit(passed === tests.length ? 0 : 1);
})();
