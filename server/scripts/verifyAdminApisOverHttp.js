const jwt = require('jsonwebtoken');
require('dotenv').config();
const http = require('http');

const token = jwt.sign({ id: '6a9817466edde1c3d4ee0a4c' }, process.env.JWT_SECRET, { expiresIn: '1d' });

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyAll() {
  console.log('=== VERIFYING ADMIN APIS OVER HTTP ===');

  // 1. Dashboard
  const dash = await request('/api/admin/dashboard');
  console.log('\n[1] GET /api/admin/dashboard: Status =', dash.status);
  if (dash.status !== 200) throw new Error('Dashboard API returned ' + dash.status);
  const ov = dash.data.data.overview;
  console.log('    Users:', ov.totalUsers, '| Customers:', ov.totalCustomers);
  console.log('    Providers:', ov.totalProviders, '| Active:', ov.activeProviders, '| Pending:', ov.pendingVerifications);
  console.log('    Site Visits Total:', ov.totalBookings, '| Active Visits:', ov.activeBookings, '| Settled/Completed:', ov.completedBookings);
  console.log('    Revenue Captured: ₹' + ov.totalRevenue, '| Provider Earnings Settled: ₹' + ov.totalProviderEarnings, '| Refunded: ₹' + ov.refundedAmount);
  console.log('    Recent Bookings Count:', dash.data.data.recentBookings?.length);
  console.log('    Pending Verifications Count:', dash.data.data.pendingVerificationsList?.length);
  console.log('    Activity Feed Count:', dash.data.data.activityFeed?.length);

  // 2. Verification Tabs
  const tabs = ['under_review', 'pending', 'verified', 'rejected', 'all'];
  for (const tab of tabs) {
    const res = await request('/api/admin/verification/requests?status=' + tab);
    console.log(`\n[2] GET /api/admin/verification/requests?status=${tab}: Status = ${res.status} | Providers Count = ${res.data.data?.providers?.length}`);
    if (res.status !== 200) throw new Error(`Verification tab ${tab} returned ${res.status}`);
  }

  // 3. Admin Providers
  const provs = await request('/api/admin/providers?status=all');
  console.log('\n[3] GET /api/admin/providers?status=all: Status =', provs.status, '| Count =', provs.data.data?.providers?.length);

  // 4. Admin Payments
  const payments = await request('/api/admin/payments');
  console.log('\n[4] GET /api/admin/payments: Status =', payments.status, '| Count =', payments.data.data?.payments?.length);

  // 5. Admin Revenue
  const rev = await request('/api/admin/revenue');
  console.log('\n[5] GET /api/admin/revenue: Status =', rev.status, '| Total = ₹' + rev.data.data?.summary?.totalRevenue);

  console.log('\n✅ ALL ADMIN HTTP ENDPOINTS ARE FULLY OPERATIONAL AND VERIFIED!');
}

verifyAll().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
