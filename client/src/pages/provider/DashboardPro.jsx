import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeIndianRupee, CalendarDays, CheckCircle2, Clock3, Gauge, IndianRupee, Star, TimerReset } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { PageSpinner } from '../../components/common/Spinner';
import { BookingCard, EmptyState, PageHeader, PanelCard, ReviewCard, StatCard } from './ProviderPanelComponents';
import { formatMoney, profileCompletion } from './providerPanelUtils';
import { useProviderPanelData } from './useProviderPanelData';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#7c3aed', '#0891b2'];

const ProviderDashboardPro = () => {
  const navigate = useNavigate();
  const { provider, bookings, reviews, loading, error, metrics, monthlySeries, statusSeries } = useProviderPanelData();

  if (loading) return <AppLayout><PageSpinner /></AppLayout>;

  const completion = profileCompletion(provider);
  const recentBookings = bookings.slice(0, 5);
  const recentReviews = reviews.slice(0, 3);

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader
          eyebrow="Provider Workspace"
          title="Business Dashboard"
          description="Track jobs, revenue, customer experience, and operational health from one control room."
          actions={<button className="btn btn-primary" onClick={() => navigate('/provider/profile')}>Complete Profile</button>}
        />

        {error && <div className="provider-alert">{error}</div>}

        <div className="provider-hero-panel">
          <div>
            <span>Profile strength</span>
            <h2>{completion}% complete</h2>
            <p>Verified profiles with services, documents, portfolio, and availability enabled receive more booking requests.</p>
          </div>
          <div className="provider-completion-ring" style={{ '--value': `${completion * 3.6}deg` }}>
            <strong>{completion}%</strong>
          </div>
        </div>

        <div className="provider-stats-grid">
          <StatCard icon={<CalendarDays size={22} />} label="Today's Visits" value={metrics.todaysJobs.length} meta="Scheduled today" tone="blue" />
          <StatCard icon={<Clock3 size={22} />} label="Upcoming Visits" value={metrics.upcoming.length} meta="Accepted or pending" tone="cyan" delay={0.04} />
          <StatCard icon={<IndianRupee size={22} />} label="Monthly Earnings" value={formatMoney(metrics.monthlyEarnings)} meta="Completed this month" tone="green" delay={0.08} />
          <StatCard icon={<BadgeIndianRupee size={22} />} label="Pending Earnings" value={formatMoney(metrics.pendingEarnings)} meta="Active pipeline" tone="amber" delay={0.12} />
          <StatCard icon={<CheckCircle2 size={22} />} label="Completed Site Visits" value={metrics.completed.length} meta="Lifetime site visits" tone="violet" delay={0.16} />
          <StatCard icon={<Star size={22} />} label="Average Rating" value={Number(provider?.rating?.average || 0).toFixed(1)} meta={`${provider?.rating?.totalReviews || 0} reviews`} tone="amber" delay={0.2} />
          <StatCard icon={<TimerReset size={22} />} label="Response Time" value={metrics.responseTime} meta="Median reply window" tone="cyan" delay={0.24} />
          <StatCard icon={<Gauge size={22} />} label="Acceptance / Completion" value={`${metrics.acceptanceRate}% / ${metrics.completionRate}%`} meta="Operational quality" tone="green" delay={0.28} />
        </div>

        <div className="provider-grid provider-grid-2">
          <PanelCard title="Monthly Earnings" subtitle="Completed site visit earnings over the last six months">
            <div className="provider-chart">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlySeries}>
                  <defs>
                    <linearGradient id="earningsFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={value => `₹${value / 1000}k`} />
                  <Tooltip formatter={value => formatMoney(value)} />
                  <Area type="monotone" dataKey="earnings" stroke="#2563eb" strokeWidth={3} fill="url(#earningsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PanelCard>

          <PanelCard title="Booking Status" subtitle="Current distribution across the job lifecycle">
            {statusSeries.length ? (
              <div className="provider-chart provider-chart-split">
                <ResponsiveContainer width="52%" height={250}>
                  <PieChart>
                    <Pie data={statusSeries} innerRadius={58} outerRadius={86} paddingAngle={4} dataKey="value">
                      {statusSeries.map((entry, index) => <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="provider-chart-legend">
                  {statusSeries.map((item, index) => (
                    <span key={item.status}><i style={{ background: COLORS[index % COLORS.length] }} />{item.name} <strong>{item.value}</strong></span>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState title="No bookings yet" description="Status insights will appear as requests come in." />
            )}
          </PanelCard>
        </div>

        <div className="provider-grid provider-grid-2">
          <PanelCard
            title="Recent Bookings"
            subtitle="Latest requests and job updates"
            action={<button className="provider-link-button" onClick={() => navigate('/provider/bookings')}>View all</button>}
          >
            {recentBookings.length ? recentBookings.map(booking => (
              <BookingCard
                key={booking._id}
                booking={booking}
                compact
                action={<button className="btn btn-sm btn-outline" onClick={() => navigate(`/provider/bookings/${booking._id}`)}>Open</button>}
              />
            )) : <EmptyState title="No booking activity" description="New requests will land here as customers book your services." />}
          </PanelCard>

          <PanelCard
            title="Recent Reviews"
            subtitle="Fresh customer feedback"
            action={<button className="provider-link-button" onClick={() => navigate('/provider/reviews')}>Manage reviews</button>}
          >
            {recentReviews.length ? recentReviews.map(review => (
              <ReviewCard key={review._id} review={review} />
            )) : <EmptyState title="No reviews yet" description="Customer reviews will appear after completed jobs." />}
          </PanelCard>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProviderDashboardPro;
