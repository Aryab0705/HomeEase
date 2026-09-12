export const SERVICE_CATEGORIES = [
  'Plumbing',
  'Electrician',
  'Painting',
  'Carpenter',
  'AC Repair',
  'Cleaning',
  'Renovation',
  'Appliance Repair',
  'Pest Control',
  'Interior Design',
];

export const BOOKING_STATUS_LABELS = {
  pending:              'Pending',
  accepted:             'Accepted',
  rejected:             'Rejected',
  on_the_way:           'On the Way',
  arrived:              'Arrived',
  site_visit_completed: 'Site Visit Completed',
  customer_decision:    'Customer Decision',
  settled:              'Settled',
  completed:            'Completed',
  cancelled:            'Cancelled',
};

export const ACTIVE_STATUSES = ['accepted', 'on_the_way', 'arrived', 'site_visit_completed', 'customer_decision'];
export const HISTORY_STATUSES = ['settled', 'completed', 'cancelled', 'rejected'];

export const formatMoney = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const formatShortDate = value => {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatTimeRange = slot => {
  if (!slot?.start && !slot?.end) return 'Flexible';
  return `${slot.start || '--:--'} - ${slot.end || '--:--'}`;
};

export const getBookingAmount = booking => {
  const fee =
    booking?.siteVisitFee ||
    booking?.consultationFee ||
    booking?.pricing?.consultationFee ||
    booking?.totalAmount ||
    booking?.estimatedAmount ||
    booking?.serviceId?.basePrice ||
    0;
  return Number(fee);
};

export const groupByStatus = bookings =>
  bookings.reduce((acc, booking) => {
    const key = booking.status || 'pending';
    acc[key] = [...(acc[key] || []), booking];
    return acc;
  }, {});

export const getProviderUser = provider => provider?.userId || provider?.user || {};

export const profileCompletion = provider => {
  const user = getProviderUser(provider);
  const checks = [
    user.avatar,
    user.name,
    user.phone,
    user.email,
    provider?.bio,
    provider?.experience !== undefined,
    provider?.serviceArea?.city,
    provider?.serviceArea?.radius,
    provider?.services?.length,
    provider?.availability?.workingDays?.length,
    provider?.documents?.length,
    provider?.portfolio?.length,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

export const makeMonthlySeries = bookings => {
  const formatter = new Intl.DateTimeFormat('en-IN', { month: 'short' });
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: formatter.format(d),
      earnings: 0,
      jobs: 0,
    };
  });

  bookings.forEach(booking => {
    const isEarned =
      booking.settlementStatus === 'PROVIDER_EARNED' ||
      booking.status === 'settled' ||
      booking.status === 'completed';
    if (!isEarned) return;

    const date = new Date(
      booking.settledAt ||
      booking.siteVisitCompletedAt ||
      booking.completedAt ||
      booking.scheduledDate ||
      booking.createdAt
    );
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const item = months.find(m => m.key === key);
    if (item) {
      item.earnings += getBookingAmount(booking);
      item.jobs += 1;
    }
  });

  return months;
};

export const makeStatusSeries = bookings => {
  const counts = groupByStatus(bookings);
  return Object.entries(BOOKING_STATUS_LABELS).map(([status, name]) => ({
    status,
    name,
    value: counts[status]?.length || 0,
  })).filter(item => item.value > 0);
};

export const calculateProviderMetrics = (provider, bookings) => {
  const now = new Date();
  const todayKey = now.toDateString();
  const completed = bookings.filter(
    b => b.settlementStatus === 'PROVIDER_EARNED' || b.status === 'settled' || b.status === 'completed'
  );
  const pending = bookings.filter(b => b.status === 'pending');
  const accepted = bookings.filter(b => b.status !== 'rejected' && b.status !== 'cancelled');
  const active = bookings.filter(b => ACTIVE_STATUSES.includes(b.status));
  const upcoming = bookings.filter(b => {
    const date = new Date(b.scheduledDate);
    return date >= now && !['settled', 'completed', 'cancelled', 'rejected'].includes(b.status);
  });
  const todaysJobs = bookings.filter(b => new Date(b.scheduledDate).toDateString() === todayKey);
  const monthlyCompleted = completed.filter(b => {
    const date = new Date(b.settledAt || b.siteVisitCompletedAt || b.completedAt || b.scheduledDate);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const monthlyEarnings = monthlyCompleted.reduce((sum, b) => sum + getBookingAmount(b), 0);
  const lifetimeEarnings = completed.reduce((sum, b) => sum + getBookingAmount(b), 0) || provider?.totalEarnings || 0;
  const pendingEarnings = active.reduce((sum, b) => sum + getBookingAmount(b), 0);
  const acceptanceRate = bookings.length ? Math.round((accepted.length / bookings.length) * 100) : 100;
  const completionRate = accepted.length ? Math.round((completed.length / accepted.length) * 100) : 100;
  const responseTime = pending.length > 0 ? '12 min' : '8 min';
  const averageFee = completed.length ? Math.round(lifetimeEarnings / completed.length) : 0;

  return {
    todaysJobs,
    upcoming,
    completed,
    pending,
    active,
    monthlyEarnings,
    pendingEarnings,
    lifetimeEarnings,
    acceptanceRate,
    completionRate,
    responseTime,
    averageFee,
  };
};
