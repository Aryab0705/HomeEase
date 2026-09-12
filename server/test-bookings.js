// test-bookings.js — Test booking API
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
  console.log('\n=== HomeEase Bookings API Test ===\n');

  // Login as customer
  console.log('Step 1: Customer Login...');
  const customerLogin = await post('/api/auth/login', { email: 'customer@demo.com', password: 'password123' });
  if (customerLogin.status !== 200) {
    console.log('❌ Customer login failed:', customerLogin.status, customerLogin.body?.message);
    process.exit(1);
  }
  const customerToken = customerLogin.body.accessToken;
  console.log('✅ Customer login OK\n');

  // Get providers to find a provider ID
  console.log('Step 2: Get Providers...');
  const providersRes = await get('/api/providers', customerToken);
  if (providersRes.status !== 200 || !providersRes.body.data?.providers?.length) {
    console.log('❌ Failed to get providers');
    process.exit(1);
  }
  const providerId = providersRes.body.data.providers[0]._id;
  console.log(`✅ Got provider ID: ${providerId}\n`);

  // Get services to find a service ID
  console.log('Step 3: Get Services...');
  const servicesRes = await get('/api/services', customerToken);
  if (servicesRes.status !== 200 || !servicesRes.body.data?.services?.length) {
    console.log('❌ Failed to get services');
    process.exit(1);
  }
  const serviceId = servicesRes.body.data.services[0]._id;
  console.log(`✅ Got service ID: ${serviceId}\n`);

  // Test booking endpoints
  const tests = [
    { path: '/api/bookings/my', name: 'Get Customer Bookings', token: customerToken },
    { path: '/api/bookings/', name: 'Create Booking', method: 'POST', token: customerToken, body: {
      providerId,
      serviceId,
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      address: { street: '123 Test St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      description: 'Test booking'
    }},
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
    const count = result.body.data?.bookings?.length || result.body.data?.booking ? 'YES' : 'NO';
    console.log(`${ok ? '✅' : '❌'} ${test.name}: HTTP ${result.status} | data: ${count}`);
    if (!ok) console.log(`   Error: ${result.body?.message || result.error}`);
  }

  console.log(`\n=== RESULT: ${passed}/${tests.length} booking tests PASSED ===\n`);
  process.exit(passed === tests.length ? 0 : 1);
})();
