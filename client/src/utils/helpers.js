// ─── Status helpers ─────────────────────────────────────────────────────────
export const STATUS_LABELS = {
  pending:              'Pending',
  accepted:             'Accepted',
  rejected:             'Rejected',
  on_the_way:           'On The Way',
  arrived:              'Arrived',
  site_visit_completed: 'Site Visit Completed',
  customer_decision:    'Customer Decision',
  settled:              'Settled',
  completed:            'Completed',
  cancelled:            'Cancelled',
};

export const getStatusClass = (status) => {
  return `badge status-${status}`;
};

// ─── Rating helper ──────────────────────────────────────────────────────────
export const renderStars = (rating) => {
  return Array.from({ length: 5 }, (_, i) => ({
    filled: i < Math.round(rating),
    key: i,
  }));
};

// ─── Date helpers ───────────────────────────────────────────────────────────
export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

export const formatTime = (date) =>
  new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

export const formatDateTime = (date) => `${formatDate(date)} ${formatTime(date)}`;

export const timeAgo = (date) => {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatDate(date);
};

// ─── Currency helper ─────────────────────────────────────────────────────────
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

// ─── Avatar initials ─────────────────────────────────────────────────────────
export const getInitials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ─── Error message extractor ─────────────────────────────────────────────────
export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong';

// ─── Category icons map ──────────────────────────────────────────────────────
export const CATEGORY_ICONS = {
  Plumbing:         '🔧',
  Electrician:      '⚡',
  Painting:         '🖌️',
  Carpenter:        '🪚',
  'AC Repair':      '❄️',
  Cleaning:         '🧹',
  Renovation:       '🏗️',
  'Appliance Repair':'🔌',
  'Pest Control':   '🐛',
  'Interior Design':'🛋️',
};

export const SERVICE_CATEGORIES = [
  'Plumbing','Electrician','Painting','Carpenter',
  'AC Repair','Cleaning','Renovation','Appliance Repair',
  'Pest Control','Interior Design',
];
