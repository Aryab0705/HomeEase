// live-api-test.js — Test all new admin endpoints with a real JWT
require('dotenv').config();
const http = require('http');

const BASE = 'localhost';
const PORT = 5000;

// Helper: HTTP GET with JSON
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

// Helper: HTTP POST with JSON body
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
  console.log('\n=== HomeEase Admin API Live Test ===\n');

  // Step 1: Login as admin to get token
  console.log('Step 1: Admin Login...');
  const login = await post('/api/auth/login', { email: 'admin@demo.com', password: 'password123' });
  if (login.status !== 200) {
    console.log('❌ Admin login failed:', login.status, login.body?.message);
    process.exit(1);
  }
  const token = login.body.accessToken;
  console.log('✅ Admin login OK | role:', login.body.user?.role, '\n');

  // Step 2: Test all new admin endpoints
  const endpoints = [
    { path: '/api/admin/dashboard',              name: 'Dashboard Stats' },
    { path: '/api/admin/bookings?page=1&limit=5', name: 'Admin Bookings' },
    { path: '/api/admin/revenue?period=monthly',  name: 'Revenue (monthly)' },
    { path: '/api/admin/revenue?period=daily',    name: 'Revenue (daily)' },
    { path: '/api/admin/complaints?page=1',        name: 'Complaints' },
    { path: '/api/admin/reviews?page=1',           name: 'Reviews' },
    { path: '/api/admin/activity?page=1',          name: 'Activity Log' },
    { path: '/api/admin/search?q=demo',            name: 'Global Search' },
    { path: '/api/admin/analytics',               name: 'Analytics (legacy)' },
    { path: '/api/admin/users',                   name: 'Admin Users' },
    { path: '/api/admin/providers/pending',        name: 'Pending Providers' },
  ];

  let passed = 0;
  for (const ep of endpoints) {
    const r = await get(ep.path, token);
    const ok = r.status === 200;
    if (ok) passed++;
    
    let detail = '';
    if (ok && ep.name === 'Dashboard Stats') {
      const ov = r.body.data?.overview || {};
      detail = `| customers:${ov.totalCustomers} providers:${ov.totalProviders} bookingsToday:${ov.bookingsToday} openComplaints:${ov.openComplaints}`;
    } else if (ok && ep.name === 'Revenue (monthly)') {
      const t = r.body.data?.totals || {};
      detail = `| revenue:₹${t.revenue} commission:₹${t.commission} bookings:${t.bookings}`;
    } else if (ok && ep.name === 'Global Search') {
      const d = r.body.data || {};
      detail = `| users:${d.users?.length} providers:${d.providers?.length} bookings:${d.bookings?.length}`;
    } else if (ok) {
      const d = r.body.data || {};
      const count = d.pagination?.total ?? d.bookings?.length ?? d.complaints?.length ?? d.reviews?.length ?? d.activities?.length ?? (Array.isArray(d.users) ? d.users.length : '');
      detail = count !== '' ? `| count:${count}` : '';
    }

    console.log(`${ok ? '✅' : '❌'} ${ep.name.padEnd(22)} HTTP ${r.status} ${detail}`);
    if (!ok && r.body?.message) console.log(`     Error: ${r.body.message}`);
  }

  console.log(`\n=== RESULT: ${passed}/${endpoints.length} endpoints PASSED ===\n`);
  process.exit(passed === endpoints.length ? 0 : 1);
})();
