import { motion } from 'framer-motion';
import { AlertCircle, BriefcaseBusiness, CalendarClock, CheckCircle2, Clock, MessageCircle, Star } from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import Avatar from '../../components/common/Avatar';
import { formatMoney, formatShortDate, formatTimeRange, getBookingAmount } from './providerPanelUtils';

const REVIEW_CATEGORY_LABELS = [
  { key: 'workQuality', label: 'Work Quality', legacy: 'quality' },
  { key: 'punctuality', label: 'Punctuality', legacy: 'timeliness' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'valueForMoney', label: 'Value for Money' },
];

export const PageHeader = ({ eyebrow, title, description, actions }) => (
  <div className="provider-page-header">
    <div>
      {eyebrow && <p className="provider-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="provider-header-actions">{actions}</div>}
  </div>
);

export const StatCard = ({ icon, label, value, meta, tone = 'blue', delay = 0 }) => (
  <motion.div
    className={`provider-stat-card provider-tone-${tone}`}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <div className="provider-stat-icon">{icon}</div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {meta && <small>{meta}</small>}
    </div>
  </motion.div>
);

export const PanelCard = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`provider-panel-card ${className}`}>
    {(title || action) && (
      <div className="provider-card-head">
        <div>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const EmptyState = ({ icon, title, description, action }) => (
  <div className="provider-empty-state">
    <div className="provider-empty-icon">{icon || <AlertCircle size={24} />}</div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action}
  </div>
);

export const BookingCard = ({ booking, action, compact = false }) => (
  <article className={`provider-booking-card${compact ? ' compact' : ''}`}>
    <div className="provider-booking-main">
      <div className="provider-booking-icon">
        <BriefcaseBusiness size={18} />
      </div>
      <div>
        <h3>{booking.serviceId?.name || 'Home service'}</h3>
        <p>{booking.customerId?.name || 'Customer'} · {booking.address?.city || 'Service area'}</p>
        <div className="provider-booking-meta">
          <span><CalendarClock size={14} /> {formatShortDate(booking.scheduledDate)}</span>
          <span><Clock size={14} /> {formatTimeRange(booking.scheduledTimeSlot)}</span>
          {booking.paymentStatus && (
            <span style={{ fontWeight: 600, color: booking.paymentStatus === 'paid' ? '#16a34a' : '#ea580c' }}>
              • Payment: {booking.paymentStatus.toUpperCase()}
            </span>
          )}
          {booking.settlementStatus && (
            <span style={{ fontWeight: 600, color: booking.settlementStatus === 'PROVIDER_EARNED' ? '#16a34a' : '#6b7280' }}>
              • Settlement: {booking.settlementStatus.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    </div>
    <div className="provider-booking-side">
      <StatusBadge status={booking.status} />
      <div style={{ textAlign: 'right' }}>
        <small style={{ display: 'block', fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Site Visit Fee</small>
        <strong>{formatMoney(getBookingAmount(booking))}</strong>
      </div>
      {action}
    </div>
  </article>
);

export const ProgressTimeline = ({ status }) => {
  const steps = [
    { key: 'accepted', label: 'Accepted' },
    { key: 'on_the_way', label: 'On The Way' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'completed', label: 'Completed' },
  ];
  const activeIndex = steps.findIndex(s => s.key === status);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className="provider-timeline">
      <div className="provider-timeline-track" />
      {steps.map((step, index) => {
        const isDone = index < currentIndex || status === 'completed';
        const isCurrent = index === currentIndex && status !== 'completed';
        return (
          <div
            key={step.key}
            className={`provider-timeline-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
          >
            <div className="provider-timeline-step-icon">
              {isDone ? <CheckCircle2 size={15} /> : index + 1}
            </div>
            <p>{step.label}</p>
          </div>
        );
      })}
    </div>
  );
};

export const ReviewCard = ({ review, onReply }) => {
  const customer = review?.customerId;
  const ratings = review?.ratings || {};

  return (
    <article className="provider-review-card">
      <div className="provider-review-top">
        {/* Avatar already renders initials, then a fallback icon, on its own. */}
        <Avatar src={customer?.avatar?.url} name={customer?.name || 'Customer'} size="md" />
        <div>
          <h3>{customer?.name || 'Customer'}</h3>
          <p>{formatShortDate(review?.createdAt)}</p>
        </div>
        <div className="provider-review-rating">
          <Star size={15} fill="currentColor" />
          {Number(review?.overallRating || 0).toFixed(1)}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 4px' }}>
        {REVIEW_CATEGORY_LABELS.map(({ key, label, legacy }) => {
          const score = ratings[key] ?? (legacy ? ratings[legacy] : undefined);
          if (!score) return null;
          return (
            <span
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--text-light)',
                background: 'var(--bg, #f8fafc)',
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {label}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: 'var(--text-dark)' }}>
                <Star size={11} fill="#f59e0b" stroke="#f59e0b" />
                {score}
              </span>
            </span>
          );
        })}
      </div>

      <p className="provider-review-copy">{review?.comment || 'No written comment.'}</p>
      {review?.providerResponse?.comment ? (
        <div className="provider-reply-box">
          <strong>Your reply</strong>
          <p>{review.providerResponse.comment}</p>
        </div>
      ) : (
        <button className="provider-link-button" onClick={() => onReply?.(review)}>
          <MessageCircle size={15} /> Reply
        </button>
      )}
    </article>
  );
};
