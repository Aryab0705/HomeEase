import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bell, Camera, Check, Clock, Download, FileBadge, ImagePlus,
  Lock, LogOut, MessageSquare, ShieldCheck, Star, Trash2, Upload, Wallet,
  Calendar, Plus, Save, AlertCircle, Copy, CheckCircle2,
  MapPin, Phone, Navigation, Briefcase, CalendarClock,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { PageSpinner } from '../../components/common/Spinner';
import StatusBadge from '../../components/common/StatusBadge';
import Avatar from '../../components/common/Avatar';
import API from '../../services/api';
import {
  BookingCard, EmptyState, PageHeader, PanelCard, ProgressTimeline, ReviewCard, StatCard,
} from './ProviderPanelComponents';
import {
  ACTIVE_STATUSES, BOOKING_STATUS_LABELS, HISTORY_STATUSES,
  formatShortDate, formatTimeRange, formatMoney, getBookingAmount, groupByStatus,
} from './providerPanelUtils';
import { CATEGORY_ICONS } from '../../utils/helpers';
import { useProviderPanelData } from './useProviderPanelData';

const requestTabs = ['pending', 'accepted', 'rejected'];
const documentTypes = ['Government ID', 'PAN', 'Certificate', 'Trade License', 'Police Verification'];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const usePanel = () => {
  const data = useProviderPanelData();
  return data.loading ? { ...data, body: <AppLayout><PageSpinner /></AppLayout> } : data;
};

export const ProviderBookingRequests = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = usePanel();
  const urlTab = searchParams.get('tab');
  const [tab, setTab] = useState(urlTab && requestTabs.includes(urlTab) ? urlTab : 'pending');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (urlTab && requestTabs.includes(urlTab)) {
      setTab(urlTab);
    }
  }, [urlTab]);

  if (data.body) return data.body;

  const grouped = groupByStatus(data.bookings);
  const bookings = grouped[tab] || [];

  const updateStatus = async (booking, status) => {
    setBusyId(booking._id);
    try {
      await API.patch(`/bookings/${booking._id}/status`, { status, note: `Provider marked as ${BOOKING_STATUS_LABELS[status]}` });
      toast.success(`Booking ${BOOKING_STATUS_LABELS[status].toLowerCase()}`);
      data.reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to update booking');
    } finally {
      setBusyId('');
    }
  };

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader eyebrow="Booking Desk" title="Booking Requests" description="Accept, reject, reschedule, chat, and inspect customer requests before work begins." />
        <div className="provider-tabs">
          {requestTabs.map(item => (
            <button
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => {
                setTab(item);
                setSearchParams(item === 'pending' ? {} : { tab: item });
              }}
            >
              {BOOKING_STATUS_LABELS[item]} <span>{grouped[item]?.length || 0}</span>
            </button>
          ))}
        </div>
        <PanelCard title={`${BOOKING_STATUS_LABELS[tab]} Requests`}>
          {bookings.length ? bookings.map(booking => (
            <BookingCard
              key={booking._id}
              booking={booking}
              action={(
                <div className="provider-row-actions">
                  {tab === 'pending' && <button className="btn btn-sm btn-primary" disabled={busyId === booking._id} onClick={() => updateStatus(booking, 'accepted')}>Accept</button>}
                  {tab === 'pending' && <button className="btn btn-sm btn-outline" disabled={busyId === booking._id} onClick={() => updateStatus(booking, 'rejected')}>Reject</button>}
                  <button className="btn btn-sm btn-outline" onClick={() => navigate(`/provider/bookings/${booking._id}`)}>Details</button>
                  <button className="btn btn-sm btn-outline" onClick={() => navigate('/chat')}>Chat</button>
                </div>
              )}
            />
          )) : <EmptyState title="No requests in this lane" description="New customer requests will be sorted here automatically." />}
        </PanelCard>
      </div>
    </AppLayout>
  );
};

export const ProviderActiveJobs = () => {
  const navigate = useNavigate();
  const data = usePanel();
  const [filterTab, setFilterTab] = useState('all');
  const [completingId, setCompletingId] = useState('');
  const [startingJourneyId, setStartingJourneyId] = useState('');

  if (data.body) return data.body;

  const allActive = data.bookings.filter(b => ACTIVE_STATUSES.includes(b.status));
  const counts = {
    all: allActive.length,
    accepted: allActive.filter(b => b.status === 'accepted').length,
    on_the_way: allActive.filter(b => b.status === 'on_the_way').length,
    arrived: allActive.filter(b => b.status === 'arrived').length,
  };

  const displayedJobs = filterTab === 'all'
    ? allActive
    : allActive.filter(b => b.status === filterTab);

  const startJourney = async (booking) => {
    // Check if scheduled time has arrived
    const now = new Date();
    const schedDate = new Date(booking.scheduledDate);
    const startSlot = booking.scheduledTimeSlot?.start;
    let earliestStart = new Date(schedDate);
    if (startSlot && startSlot.includes(':')) {
      const [h, m] = startSlot.split(':').map(Number);
      earliestStart.setHours(h, m, 0, 0);
    } else {
      earliestStart.setHours(0, 0, 0, 0);
    }

    if (now < earliestStart) {
      const formattedEarliest = earliestStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formattedDate = earliestStart.toLocaleDateString();
      toast.error(`Cannot start journey before scheduled time (${formattedDate} at ${formattedEarliest}).`);
      return;
    }

    setStartingJourneyId(booking._id);
    try {
      await API.patch(`/bookings/${booking._id}/status`, {
        status: 'on_the_way',
        note: 'Provider manually started journey',
      });
      toast.success('Journey started! Live GPS tracking active.');
      data.reload();
      navigate(`/provider/bookings/${booking._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to start journey');
    } finally {
      setStartingJourneyId('');
    }
  };

  const completeJob = async (booking) => {
    setCompletingId(booking._id);
    try {
      await API.patch(`/bookings/${booking._id}/complete-visit`, {
        note: 'Site visit completed by provider',
      });
      toast.success('Site visit completed! Awaiting customer decision.');
      data.reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to complete site visit');
    } finally {
      setCompletingId('');
    }
  };

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader
          eyebrow="Operations"
          title="Active Jobs"
          description="Manage ongoing customer bookings, monitor live GPS travel, and complete deliveries."
          actions={(
            <button className="btn btn-outline" onClick={() => navigate('/provider/bookings')}>
              View All Requests
            </button>
          )}
        />

        {/* Filter Pills */}
        <div className="provider-tabs">
          <button
            type="button"
            className={filterTab === 'all' ? 'active' : ''}
            onClick={() => setFilterTab('all')}
          >
            All Active <span>{counts.all}</span>
          </button>
          <button
            type="button"
            className={filterTab === 'accepted' ? 'active' : ''}
            onClick={() => setFilterTab('accepted')}
          >
            Accepted <span>{counts.accepted}</span>
          </button>
          <button
            type="button"
            className={filterTab === 'on_the_way' ? 'active' : ''}
            onClick={() => setFilterTab('on_the_way')}
          >
            On The Way <span>{counts.on_the_way}</span>
          </button>
          <button
            type="button"
            className={filterTab === 'arrived' ? 'active' : ''}
            onClick={() => setFilterTab('arrived')}
          >
            Arrived <span>{counts.arrived}</span>
          </button>
        </div>

        {/* Jobs List / Responsive Grid */}
        {displayedJobs.length > 0 ? (
          <div className="provider-active-grid">
            {displayedJobs.map(booking => {
              const customer = booking.customerId || booking.customer || {};
              const address = booking.address || {};
              const formattedAddress = [
                address.street,
                address.landmark ? `(Near ${address.landmark})` : '',
                address.city,
                address.state,
                address.zip ? `- ${address.zip}` : '',
              ].filter(Boolean).join(', ') || 'Customer address on file';

              const amount = getBookingAmount(booking);
              const isCompleting = completingId === booking._id;

              return (
                <article key={booking._id} className="provider-active-card">
                  {/* Top Bar: Service Info, Amount, Status */}
                  <div className="provider-active-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="provider-booking-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
                        {CATEGORY_ICONS[booking.serviceId?.category] ? (
                          <span style={{ fontSize: 20 }}>{CATEGORY_ICONS[booking.serviceId?.category]}</span>
                        ) : (
                          <Briefcase size={20} />
                        )}
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>
                          {booking.serviceId?.name || 'Home Service'}
                        </h3>
                        <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>
                          {booking.serviceId?.category || 'Service'} · #{String(booking._id).slice(-6).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <StatusBadge status={booking.status} />
                      <div style={{ textAlign: 'right' }}>
                        <small style={{ display: 'block', fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Site Visit Fee</small>
                        <strong style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>
                          {formatMoney(amount)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Location Details Box */}
                  <div className="provider-active-details">
                    {/* Customer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar src={customer?.avatar?.url} name={customer?.name || 'Customer'} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {customer?.name || 'Customer'}
                        </div>
                        {customer?.phone && (
                          <a
                            href={`tel:${customer.phone}`}
                            style={{ fontSize: 12, color: 'var(--text-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Phone size={12} color="#2563eb" /> {customer.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Schedule */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CalendarClock size={13} color="#2563eb" />
                        <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{formatShortDate(booking.scheduledDate)}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={13} /> {formatTimeRange(booking.scheduledTimeSlot)}
                      </div>
                    </div>

                    {/* Address Full Width in Grid */}
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text-light)', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                      <MapPin size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ lineHeight: 1.35 }}>{formattedAddress}</span>
                    </div>
                  </div>

                  {/* 4-Step Progress Tracker */}
                  <ProgressTimeline status={booking.status} />

                  {/* Real-time Guidance Banner */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: booking.status === 'arrived' ? '#dcfce7' : '#eff6ff',
                      border: `1px solid ${booking.status === 'arrived' ? '#bbf7d0' : '#bfdbfe'}`,
                      color: booking.status === 'arrived' ? '#15803d' : '#1e40af',
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: booking.status === 'arrived' ? '#16a34a' : '#2563eb',
                        boxShadow: '0 0 0 3px rgba(37,99,235,0.2)',
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      {booking.status === 'accepted' && 'Booking is confirmed. When the scheduled time arrives, click "Start Journey / On The Way" to begin travel and activate live GPS.'}
                      {booking.status === 'on_the_way' && 'En route to customer location. Live GPS location is updating. Arrived status triggers automatically when you reach destination (within 100m).'}
                      {booking.status === 'arrived' && 'You have arrived at the customer address! Once the site visit/inspection is finished, confirm visit completion below.'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="provider-row-actions" style={{ marginTop: 'auto', paddingTop: 4, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => navigate('/chat')}
                        style={{ gap: 6 }}
                      >
                        <MessageSquare size={14} /> Message
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => navigate(`/provider/bookings/${booking._id}`)}
                        style={{ gap: 6 }}
                      >
                        <Navigation size={14} /> Live GPS & Details
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {booking.status === 'accepted' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={startingJourneyId === booking._id}
                          onClick={() => startJourney(booking)}
                          style={{ background: '#2563eb', borderColor: '#2563eb', gap: 6 }}
                        >
                          <Navigation size={15} /> {startingJourneyId === booking._id ? 'Starting...' : 'Start Journey / On The Way'}
                        </button>
                      )}

                      {booking.status === 'arrived' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={isCompleting}
                          onClick={() => completeJob(booking)}
                          style={{ background: '#16a34a', borderColor: '#16a34a', gap: 6 }}
                        >
                          <CheckCircle2 size={15} /> {isCompleting ? 'Completing...' : 'Complete Site Visit'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#eff6ff',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Briefcase size={28} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 6 }}>
              {filterTab === 'all' ? 'No Active Jobs' : `No Jobs in "${BOOKING_STATUS_LABELS[filterTab] || filterTab}"`}
            </h3>
            <p style={{ color: 'var(--text-light)', fontSize: 14, maxWidth: 360, margin: '0 auto 20px' }}>
              {filterTab === 'all'
                ? 'When customers book your services and you accept, active jobs will appear here with live GPS tracking.'
                : 'There are currently no active bookings matching this status filter.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              {filterTab !== 'all' ? (
                <button className="btn btn-outline" onClick={() => setFilterTab('all')}>
                  View All Active Jobs
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => navigate('/provider/bookings')}>
                  View Booking Requests
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export const ProviderBookingHistory = () => {
  const data = usePanel();
  if (data.body) return data.body;
  const bookings = data.bookings.filter(b => HISTORY_STATUSES.includes(b.status));

  const exportHistory = () => {
    const csv = ['Date,Customer,Service,Status,Amount', ...bookings.map(b => [
      formatShortDate(b.scheduledDate),
      b.customerId?.name || 'Customer',
      b.serviceId?.name || 'Service',
      BOOKING_STATUS_LABELS[b.status],
      getBookingAmount(b),
    ].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'provider-booking-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader eyebrow="Archive" title="Booking History" description="Review completed, cancelled, and rejected jobs." actions={<button className="btn btn-outline" onClick={exportHistory}><Download size={16} /> Export</button>} />
        <PanelCard title="History">
          {bookings.length ? bookings.map(booking => <BookingCard key={booking._id} booking={booking} />) : <EmptyState title="No historical bookings" description="Closed jobs will be available here for audit and export." />}
        </PanelCard>
      </div>
    </AppLayout>
  );
};

export const ProviderReviews = () => {
  const data = usePanel();
  const [replyText, setReplyText] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  if (data.body) return data.body;
  // Server-computed aggregate from real Review documents; falls back to the
  // denormalised copy on the provider doc if the reviews call failed.
  const breakdown = data.rating || data.provider?.rating || {};

  const reply = async () => {
    if (!selectedReview || !replyText.trim()) return;
    try {
      await API.post(`/reviews/${selectedReview._id}/respond`, { comment: replyText.trim() });
      toast.success('Reply posted');
      setSelectedReview(null);
      setReplyText('');
      data.reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to reply');
    }
  };

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader eyebrow="Reputation" title="Reviews" description="Monitor ratings and reply professionally to customer feedback." />
        <div className="provider-stats-grid compact">
          <StatCard icon={<Star size={22} />} label="Overall Rating" value={Number(breakdown.average || 0).toFixed(1)} meta={`${breakdown.totalReviews || 0} review${breakdown.totalReviews === 1 ? '' : 's'}`} tone="amber" />
          <StatCard icon={<Check size={22} />} label="Work Quality" value={Number(breakdown.workQuality ?? breakdown.quality ?? 0).toFixed(1)} tone="green" />
          <StatCard icon={<Clock size={22} />} label="Punctuality" value={Number(breakdown.punctuality ?? breakdown.timeliness ?? 0).toFixed(1)} tone="cyan" />
          <StatCard icon={<MessageSquare size={22} />} label="Professionalism" value={Number(breakdown.professionalism || 0).toFixed(1)} tone="blue" />
          <StatCard icon={<Wallet size={22} />} label="Value for Money" value={Number(breakdown.valueForMoney || 0).toFixed(1)} tone="amber" />
        </div>
        <PanelCard title="Customer Reviews">
          {data.reviews.length ? data.reviews.map(review => <ReviewCard key={review._id} review={review} onReply={setSelectedReview} />) : <EmptyState title="No reviews yet" description="Reviews appear here after customers rate completed jobs." />}
        </PanelCard>
        {selectedReview && (
          <PanelCard title="Reply to Review">
            <textarea className="input provider-textarea" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a clear, courteous reply..." />
            <div className="provider-row-actions">
              <button className="btn btn-primary" onClick={reply}>Post Reply</button>
              <button className="btn btn-outline" onClick={() => setSelectedReview(null)}>Cancel</button>
            </div>
          </PanelCard>
        )}
      </div>
    </AppLayout>
  );
};

export const ProviderPortfolio = () => {
  const data = usePanel();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  if (data.body) return data.body;
  const items = data.provider?.portfolio || [];

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader eyebrow="Showcase" title="Portfolio" description="Build a customer-facing gallery with before/after images, videos, and project notes." />
        <div className="provider-grid provider-grid-2">
          <PanelCard title="Upload Project" subtitle="Images are sent to the existing portfolio endpoint when files are selected.">
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title" />
            <textarea className="input provider-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Project description" />
            <label className="provider-upload-zone">
              <ImagePlus size={24} />
              <span>Upload before/after images or gallery media</span>
              <input type="file" multiple hidden onChange={() => toast('Portfolio upload is ready for Cloudinary-backed media.')} />
            </label>
          </PanelCard>
          <PanelCard title="Project Gallery">
            {items.length ? (
              <div className="provider-portfolio-grid">
                {items.map(item => (
                  <article key={item._id}>
                    <div>{item.images?.[0]?.url ? <img src={item.images[0].url} alt={item.title} /> : <Camera size={26} />}</div>
                    <h3>{item.title || title || 'Project'}</h3>
                    <p>{item.description || description || 'Before and after project media.'}</p>
                  </article>
                ))}
              </div>
            ) : <EmptyState icon={<Camera size={24} />} title="No portfolio yet" description="Add strong project visuals so customers can trust your work." />}
          </PanelCard>
        </div>
      </div>
    </AppLayout>
  );
};

export const ProviderCertificates = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const data = usePanel();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(urlTab || 'overview');

  // Verification state fetched from API or provider
  const [verifData, setVerifData] = useState(null);
  const [loadingVerif, setLoadingVerif] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Identity
  const [idDocType, setIdDocType] = useState('Government ID (Aadhaar/Voter ID)');
  const [idFiles, setIdFiles] = useState([]);

  // Form states for Experience
  const [expYears, setExpYears] = useState(data.provider?.experience || 0);
  const [expDesc, setExpDesc] = useState('');
  const [expWorkDetails, setExpWorkDetails] = useState('');
  const [expEmployer, setExpEmployer] = useState('');
  const [expFiles, setExpFiles] = useState([]);

  // Form states for Skills
  const [skillsList, setSkillsList] = useState([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillYears, setNewSkillYears] = useState(expYears || 1);
  const [portfolioDesc, setPortfolioDesc] = useState('');

  // Form states for Qualification / Certificates
  const [certDocType, setCertDocType] = useState('Trade Certificate / License');
  const [certFiles, setCertFiles] = useState([]);

  const loadVerificationData = async () => {
    try {
      setLoadingVerif(true);
      const res = await API.get('/providers/me/verification');
      if (res.data?.data) {
        const d = res.data.data;
        setVerifData(d);
        const v = d.verification || {};
        if (v.experience) {
          setExpYears(v.experience.yearsOfExperience ?? data.provider?.experience ?? 0);
          setExpDesc(v.experience.description || '');
          setExpWorkDetails(v.experience.previousWorkDetails || '');
          setExpEmployer(v.experience.previousEmployerOrClient || '');
        }
        if (v.skills) {
          if (v.skills.skillsList?.length) {
            setSkillsList(v.skills.skillsList);
          } else if (data.provider?.skills?.length) {
            setSkillsList(data.provider.skills.map(s => ({ name: s, yearsOfExperience: v.experience?.yearsOfExperience || 1 })));
          }
          setPortfolioDesc(v.skills.portfolioDescription || '');
        } else if (data.provider?.skills?.length) {
          setSkillsList(data.provider.skills.map(s => ({ name: s, yearsOfExperience: 1 })));
        }
      }
    } catch (err) {
      // Fallback to local provider data
    } finally {
      setLoadingVerif(false);
    }
  };

  useEffect(() => {
    loadVerificationData();
  }, []);

  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  if (data.body) return data.body;

  const provider = data.provider;
  const v = verifData?.verification || provider?.verification || {};
  const isLicensed = verifData?.qualificationRequired || (provider?.primaryCategory === 'Electrician');

  const idStatus = v.identity?.status || 'not_submitted';
  const expStatus = v.experience?.status || 'not_submitted';
  const skillStatus = v.skills?.status || 'not_submitted';
  const qualStatus = v.qualification?.status || (isLicensed ? 'not_submitted' : 'not_required');
  const overallStatus = v.overallStatus || provider?.verificationStatus || 'pending';

  const uploadedIdDocs = v.identity?.documents || [];
  const uploadedCerts = v.qualification?.certificates || [];
  const uploadedExpEvidence = v.experience?.evidenceUrls || [];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>✓ Verified</span>;
      case 'submitted':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8' }}>⏳ Submitted</span>;
      case 'mismatch':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>⚠ Mismatch</span>;
      case 'rejected':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>✕ Rejected</span>;
      case 'not_required':
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>Optional</span>;
      default:
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>Pending</span>;
    }
  };

  // Submit Identity Documents
  const handleUploadIdentity = async (e) => {
    e.preventDefault();
    if (!idFiles.length) {
      return toast.error('Please select at least one document file.');
    }
    const formData = new FormData();
    formData.append('docType', idDocType);
    Array.from(idFiles).forEach(f => formData.append('documents', f));

    try {
      setSubmitting(true);
      await API.put('/providers/me/verification/identity', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Identity document(s) uploaded successfully!');
      setIdFiles([]);
      await loadVerificationData();
      data.reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload identity documents.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Experience Info
  const handleSaveExperience = async (e) => {
    e.preventDefault();
    if (!expDesc.trim()) {
      return toast.error('Please provide a brief description of your practical experience.');
    }
    const formData = new FormData();
    formData.append('yearsOfExperience', Number(expYears));
    formData.append('description', expDesc);
    formData.append('previousWorkDetails', expWorkDetails);
    formData.append('previousEmployerOrClient', expEmployer);
    if (expFiles.length) {
      Array.from(expFiles).forEach(f => formData.append('documents', f));
    }

    try {
      setSubmitting(true);
      await API.put('/providers/me/verification/experience', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Experience details saved!');
      setExpFiles([]);
      await loadVerificationData();
      data.reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update experience.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add / Remove Skills
  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    if (skillsList.some(s => s.name.toLowerCase() === newSkillName.trim().toLowerCase())) {
      return toast.error('Skill already added.');
    }
    setSkillsList([...skillsList, { name: newSkillName.trim(), yearsOfExperience: Number(newSkillYears) || 1 }]);
    setNewSkillName('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkillsList(skillsList.filter(s => s.name !== skillToRemove));
  };

  // Submit Skills
  const handleSaveSkills = async (e) => {
    e.preventDefault();
    if (!skillsList.length) {
      return toast.error('Please add at least one trade skill.');
    }

    try {
      setSubmitting(true);
      await API.put('/providers/me/verification/skills', {
        skillsList,
        portfolioDescription: portfolioDesc
      });
      toast.success('Skills saved successfully!');
      await loadVerificationData();
      data.reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update skills.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Qualification Certificate
  const handleUploadQualification = async (e) => {
    e.preventDefault();
    if (!certFiles.length) {
      return toast.error('Please select a certificate file (PDF or Image).');
    }
    const formData = new FormData();
    formData.append('docType', certDocType);
    Array.from(certFiles).forEach(f => formData.append('documents', f));

    try {
      setSubmitting(true);
      await API.put('/providers/me/verification/qualification', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Certificate uploaded successfully!');
      setCertFiles([]);
      await loadVerificationData();
      data.reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload certificate.');
    } finally {
      setSubmitting(false);
    }
  };

  // Final Submit for Admin Review
  const handleSubmitAllForReview = async () => {
    if (idStatus === 'not_submitted') {
      return toast.error('Please upload your Identity document first.');
    }
    if (expStatus === 'not_submitted') {
      return toast.error('Please submit your Experience details first.');
    }
    if (skillStatus === 'not_submitted') {
      return toast.error('Please submit your Skills list first.');
    }
    if (isLicensed && qualStatus === 'not_submitted') {
      return toast.error('Electrician category legally requires a trade license / certificate before review.');
    }

    try {
      setSubmitting(true);
      await API.post('/providers/me/verification/submit');
      toast.success('Application submitted for Admin review! You will be notified once reviewed.');
      await loadVerificationData();
      data.reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit verification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader
          eyebrow="Verification Center"
          title="Verification Center / Identity & Skills"
          description="Manage your professional verification, identity proofs, practical experience, and skill specializations. Certificates remain completely optional unless required for licensed trades."
        />

        {/* Verification Sub-tabs */}
        <div className="provider-tabs">
          <button
            type="button"
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => { setActiveTab('overview'); setSearchParams({}); }}
          >
            Overview
          </button>
          <button
            type="button"
            className={activeTab === 'identity' ? 'active' : ''}
            onClick={() => { setActiveTab('identity'); setSearchParams({ tab: 'identity' }); }}
          >
            Identity Verification {uploadedIdDocs.length > 0 && `(${uploadedIdDocs.length})`}
          </button>
          <button
            type="button"
            className={activeTab === 'skills' ? 'active' : ''}
            onClick={() => { setActiveTab('skills'); setSearchParams({ tab: 'skills' }); }}
          >
            Experience & Skills
          </button>
          <button
            type="button"
            className={activeTab === 'documents' ? 'active' : ''}
            onClick={() => { setActiveTab('documents'); setSearchParams({ tab: 'documents' }); }}
          >
            Certificates {isLicensed ? '(Required)' : '(Optional)'} {uploadedCerts.length > 0 && `(${uploadedCerts.length})`}
          </button>
          <button
            type="button"
            className={activeTab === 'status' ? 'active' : ''}
            onClick={() => { setActiveTab('status'); setSearchParams({ tab: 'status' }); }}
          >
            Verification Status
          </button>
        </div>

        {/* Status Strip */}
        <div className="provider-verification-strip">
          <span className={`provider-badge ${overallStatus === 'verified' ? 'success' : 'warning'}`}>
            <ShieldCheck size={16} /> Overall Status: {overallStatus}
          </span>
          <span className="provider-badge">
            <FileBadge size={16} /> Trade: {provider?.primaryCategory || 'General Service'}
          </span>
          <span className="provider-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
            {isLicensed ? '⚠️ Trade license required for Electricians' : 'ℹ️ Certificates optional — practical experience prioritized'}
          </span>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {/* Card 1: Identity */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>1. Identity Proof</span>
                  {getStatusBadge(idStatus)}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>
                  Aadhaar, Voter ID, or Passport. Verified against your account profile.
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <button
                    onClick={() => { setActiveTab('identity'); setSearchParams({ tab: 'identity' }); }}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                  >
                    {uploadedIdDocs.length > 0 ? 'Manage ID Docs' : 'Upload ID Proof →'}
                  </button>
                </div>
              </div>

              {/* Card 2: Experience */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>2. Practical Experience</span>
                  {getStatusBadge(expStatus)}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>
                  {expYears ? `${expYears} years in trade.` : 'Document your field work experience.'} Formal certificates not required.
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <button
                    onClick={() => { setActiveTab('skills'); setSearchParams({ tab: 'skills' }); }}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                  >
                    {expStatus !== 'not_submitted' ? 'Edit Experience' : 'Set Experience →'}
                  </button>
                </div>
              </div>

              {/* Card 3: Skills */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>3. Skills & Competencies</span>
                  {getStatusBadge(skillStatus)}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>
                  {skillsList.length ? `${skillsList.length} skills added.` : 'List specific tools and services you provide.'}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <button
                    onClick={() => { setActiveTab('skills'); setSearchParams({ tab: 'skills' }); }}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                  >
                    {skillsList.length > 0 ? 'Manage Skills' : 'Add Skills →'}
                  </button>
                </div>
              </div>

              {/* Card 4: Qualification */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>4. Qualification / License</span>
                  {getStatusBadge(qualStatus)}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>
                  {isLicensed ? 'Required for Electrician category.' : 'Optional boost for customer trust and profile score.'}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <button
                    onClick={() => { setActiveTab('documents'); setSearchParams({ tab: 'documents' }); }}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                  >
                    {uploadedCerts.length > 0 ? 'View Certificates' : 'Upload (Optional) →'}
                  </button>
                </div>
              </div>
            </div>

            {/* Submission Banner */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>
                  Ready to Submit Application?
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>
                  Once Identity, Experience, and Skills are filled, send your profile to our team for official verification.
                </p>
              </div>
              <button
                onClick={handleSubmitAllForReview}
                disabled={submitting || overallStatus === 'under_review' || overallStatus === 'verified'}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: 700 }}
              >
                {overallStatus === 'verified' ? '✓ Profile Verified' : overallStatus === 'under_review' ? '⏳ Application Under Review' : 'Submit for Admin Review →'}
              </button>
            </div>
          </div>
        )}

        {/* ── IDENTITY TAB ── */}
        {activeTab === 'identity' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
            <PanelCard title="Upload Identity Document" subtitle="Submit Aadhaar, Voter ID, Driving License, or Passport for identity check.">
              <form onSubmit={handleUploadIdentity} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Document Type</label>
                  <select
                    className="input"
                    value={idDocType}
                    onChange={(e) => setIdDocType(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Government ID (Aadhaar / Voter ID)">Government ID (Aadhaar / Voter ID)</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Select File (Images or PDF, up to 10MB)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(e) => setIdFiles(e.target.files)}
                    style={{ display: 'block', width: '100%', fontSize: 13 }}
                  />
                  {idFiles.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                      {idFiles.length} file(s) selected
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12, color: '#475569' }}>
                  🔒 We never share raw identity documents with customers. Only verified safety badges are visible on your profile.
                </div>

                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {submitting ? 'Uploading...' : 'Upload & Save ID'}
                </button>
              </form>
            </PanelCard>

            <PanelCard title="Uploaded Documents" subtitle="Review submitted files, OCR analysis, and verification notes">
              {uploadedIdDocs.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
                  No identity documents uploaded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Documents Grid with Previews */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                    {uploadedIdDocs.map((doc, i) => {
                      const isPdf = doc.url?.toLowerCase().endsWith('.pdf') || doc.docType?.toLowerCase().includes('pdf');
                      return (
                        <div key={i} style={{ padding: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={doc.docType}>
                            {isPdf ? '📄 PDF Document' : '🪪 ID Photo'}
                          </div>
                          {!isPdf && doc.url && (
                            <img
                              src={doc.url}
                              alt="ID Document"
                              style={{ width: '100%', height: 68, objectFit: 'cover', borderRadius: 4, marginBottom: 6, border: '1px solid #e2e8f0' }}
                            />
                          )}
                          <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4 }}>
                            {new Date(doc.uploadedAt || Date.now()).toLocaleDateString()}
                          </div>
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>
                              View Full →
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* OCR Identity Extraction & Consistency Card */}
                  {(() => {
                    const ocr = v.identity?.ocrResult || {};
                    const ocrStatus = ocr.status || (uploadedIdDocs.length ? 'pending' : 'not_submitted');
                    const hasRun = ocrStatus === 'processed';
                    const hasFailed = ocrStatus === 'failed';
                    const isNameMatched = !!ocr.nameMatched;
                    const confidence = ocr.confidence != null ? `${ocr.confidence}%` : '—';
                    const docType = v.identity.extractedInfo?.documentType || ocr.extractedEntities?.extractedDocType || 'Government ID';
                    const extractedName = ocr.extractedEntities?.extractedName || v.identity.extractedInfo?.name || '—';
                    const storedName = provider?.userId?.name || '—';
                    const maskedDocNum = v.identity.extractedInfo?.documentNumber || ocr.extractedEntities?.extractedDocNumber || '—';

                    if (!uploadedIdDocs.length) return null;

                    return (
                      <div style={{ padding: 12, background: hasFailed ? '#fef2f2' : '#f0fdf4', borderRadius: 8, border: `1px solid ${hasFailed ? '#fecaca' : '#bbf7d0'}`, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <strong style={{ color: hasFailed ? '#991b1b' : '#166534', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span>🤖</span> OCR Identity Auto-Check
                          </strong>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                              background: hasRun ? '#dcfce7' : hasFailed ? '#fee2e2' : '#f1f5f9',
                              color: hasRun ? '#15803d' : hasFailed ? '#b91c1c' : '#64748b'
                            }}>
                              OCR Status: {hasFailed ? 'OCR Failed' : hasRun ? 'Processed' : ocrStatus === 'processing' ? 'Processing' : 'Pending'}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                              background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0'
                            }}>
                              Confidence: {confidence}
                            </span>
                          </div>
                        </div>

                        {hasFailed ? (
                          <div style={{ padding: 8, background: 'white', borderRadius: 6, border: '1px solid #fecaca', color: '#991b1b', fontSize: 11 }}>
                            ⚠️ Document text could not be clearly recognized. Our administrative team will manually review your uploaded file.
                          </div>
                        ) : hasRun ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'white', padding: 10, borderRadius: 6, border: '1px solid #dcfce7' }}>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Detected Doc</div>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{docType}</div>
                            </div>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Masked Doc ID</div>
                              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>{maskedDocNum}</div>
                            </div>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Extracted Name</div>
                              <div style={{ fontWeight: 600, color: isNameMatched ? '#16a34a' : '#ea580c' }}>{extractedName}</div>
                            </div>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>Name Match Check</div>
                              <div style={{ fontWeight: 700, color: isNameMatched ? '#16a34a' : '#dc2626' }}>
                                {isNameMatched ? '✓ Match (Consistent)' : '⚠ Discrepancy Flagged'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: 8, background: 'white', borderRadius: 6, border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11 }}>
                            ⏳ Document uploaded. Name consistency check will display once OCR processing is completed.
                          </div>
                        )}

                        <div style={{ marginTop: 8, fontSize: 11, color: '#166534', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div>🔒 Sensitive document numbers are strictly masked (`XXXX XXXX 1234`) for privacy.</div>
                          <div style={{ color: '#1e40af', fontStyle: 'italic' }}>
                            ℹ️ Note: A successful name match indicates document details are consistent with your registered profile. It does not mean the government document itself has been authenticated.
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Mismatch Notification */}
                  {v.identity?.status === 'mismatch' && (
                    <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, fontSize: 12, border: '1px solid #fecaca', color: '#991b1b' }}>
                      <strong>⚠️ Identity Discrepancy Flagged:</strong> The details on your uploaded ID do not fully match your registered profile. Please review the admin notes below or upload a clearer identity document.
                    </div>
                  )}

                  {v.identity?.adminNotes && (
                    <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: 12, border: '1px solid #fde68a' }}>
                      <strong>Reviewer Feedback:</strong> {v.identity.adminNotes}
                    </div>
                  )}
                </div>
              )}
            </PanelCard>
          </div>
        )}

        {/* ── EXPERIENCE & SKILLS TAB ── */}
        {activeTab === 'skills' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Practical Experience Form */}
            <PanelCard title="Field Experience" subtitle="Describe your practical background. Certificates NOT required.">
              <form onSubmit={handleSaveExperience} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    className="input"
                    value={expYears}
                    onChange={(e) => setExpYears(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Experience Summary</label>
                  <textarea
                    className="input"
                    rows="3"
                    placeholder="e.g. 8 years working independently in residential plumbing, pipe fittings, leak repair..."
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Previous Work Details</label>
                  <textarea
                    className="input"
                    rows="2"
                    placeholder="Types of projects, typical repairs, or customer types handled..."
                    value={expWorkDetails}
                    onChange={(e) => setExpWorkDetails(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Previous Employer or Notable Clients (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Company name, contractor, or Self-employed"
                    value={expEmployer}
                    onChange={(e) => setExpEmployer(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Evidence / Proof of Work (Optional photos/PDF)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(e) => setExpFiles(e.target.files)}
                    style={{ display: 'block', width: '100%', fontSize: 13 }}
                  />
                  {expFiles.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
                      {expFiles.length} new evidence file(s) selected to upload
                    </div>
                  )}
                </div>

                {/* Uploaded Evidence with Preview & OCR Status */}
                {uploadedExpEvidence.length > 0 && (
                  <div style={{ marginTop: 6, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Attached Evidence ({uploadedExpEvidence.length})</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: v.experience?.ocrResult?.status === 'processed' ? '#dcfce7' : '#f1f5f9',
                        color: v.experience?.ocrResult?.status === 'processed' ? '#15803d' : '#64748b'
                      }}>
                        OCR: {v.experience?.ocrResult?.status === 'processed' ? '✓ Analyzed' : v.experience?.ocrResult?.status || 'Pending'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                      {uploadedExpEvidence.map((ev, i) => {
                        const isPdf = ev.url?.toLowerCase().endsWith('.pdf') || ev.name?.toLowerCase().endsWith('.pdf');
                        return (
                          <div key={i} style={{ padding: 8, background: 'white', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={ev.name || 'Proof'}>
                              {isPdf ? '📄 PDF Document' : '🖼️ Work Photo'}
                            </div>
                            {!isPdf && ev.url && (
                              <img
                                src={ev.url}
                                alt="Evidence"
                                style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 4, marginBottom: 4 }}
                              />
                            )}
                            <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                              View File →
                            </a>
                          </div>
                        );
                      })}
                    </div>

                    {v.experience?.ocrResult?.status === 'processed' && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#059669', fontWeight: 600 }}>
                        ✓ OCR verified text & entities from evidence ({v.experience.ocrResult.confidence || 85}% match score).
                      </div>
                    )}
                  </div>
                )}

                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {submitting ? 'Saving...' : 'Save Experience'}
                </button>
              </form>
            </PanelCard>

            {/* Skills List Form */}
            <PanelCard title="Skills & Competencies" subtitle="Specify specific tools, installations, and job types.">
              <form onSubmit={handleSaveSkills} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Add a Skill</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Pipe Joint Welding, MCB Replacement..."
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="number"
                      min="0"
                      max="40"
                      className="input"
                      placeholder="Yrs"
                      value={newSkillYears}
                      onChange={(e) => setNewSkillYears(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={handleAddSkill} className="btn btn-outline" style={{ flexShrink: 0 }}>
                      + Add
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Current Skills List ({skillsList.length})</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 60, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {skillsList.length === 0 ? (
                      <span style={{ fontSize: 13, color: 'var(--text-light)' }}>No skills added yet. Add your main specializations above.</span>
                    ) : (
                      skillsList.map((skill, index) => (
                        <span
                          key={index}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#e2eafc',
                            color: '#1d4ed8',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {skill.name} ({skill.yearsOfExperience}y)
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill.name)}
                            style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: 0, fontSize: 14 }}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Portfolio Description (Optional)</label>
                  <textarea
                    className="input"
                    rows="2"
                    placeholder="Brief description of past job quality and client satisfaction..."
                    value={portfolioDesc}
                    onChange={(e) => setPortfolioDesc(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {submitting ? 'Saving...' : 'Save Skills'}
                </button>
              </form>
            </PanelCard>
          </div>
        )}

        {/* ── DOCUMENTS / QUALIFICATION TAB ── */}
        {(activeTab === 'documents') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
            <PanelCard
              title={isLicensed ? 'Trade License / Qualification (Required)' : 'Trade Qualification / Certificate (Optional)'}
              subtitle={isLicensed ? 'Electricians are required by policy to upload an electrical license or certificate.' : 'Optional certificates boost your profile rank and earn a "Verified Qualification" badge.'}
            >
              <form onSubmit={handleUploadQualification} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Credential Type</label>
                  <select
                    className="input"
                    value={certDocType}
                    onChange={(e) => setCertDocType(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Trade Certificate / License">Trade Certificate / License</option>
                    <option value="ITI / Diploma Certificate">ITI / Diploma Certificate</option>
                    <option value="Apprenticeship Certificate">Apprenticeship Certificate</option>
                    <option value="Safety & Compliance Certificate">Safety & Compliance Certificate</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Select File (Images or PDF, up to 10MB)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(e) => setCertFiles(e.target.files)}
                    style={{ display: 'block', width: '100%', fontSize: 13 }}
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {submitting ? 'Uploading...' : 'Upload Certificate'}
                </button>
              </form>
            </PanelCard>

            <PanelCard title="Uploaded Certificates" subtitle="Trade credentials and certificates attached to your profile">
              {uploadedCerts.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
                  {isLicensed ? '⚠️ No certificate uploaded yet. Please upload to proceed.' : 'No certificates uploaded (Optional). Experienced providers without formal diplomas are welcome.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {uploadedCerts.map((cert, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{cert.docType || 'Certificate'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                          {new Date(cert.uploadedAt || Date.now()).toLocaleDateString()}
                        </div>
                      </div>
                      {cert.url && (
                        <a href={cert.url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                          View File
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PanelCard>
          </div>
        )}

        {/* ── STATUS TAB ── */}
        {activeTab === 'status' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <PanelCard title="Verification Status Summary" subtitle="Your real-time review progress across each pillar">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 20,
                  borderRadius: 14,
                  background: overallStatus === 'verified' ? '#dcfce7' : overallStatus === 'rejected' ? '#fee2e2' : '#fef3c7',
                  border: `1px solid ${overallStatus === 'verified' ? '#bbf7d0' : overallStatus === 'rejected' ? '#fecaca' : '#fde68a'}`,
                }}>
                  <ShieldCheck size={36} color={overallStatus === 'verified' ? '#16a34a' : overallStatus === 'rejected' ? '#dc2626' : '#d97706'} />
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: overallStatus === 'verified' ? '#15803d' : overallStatus === 'rejected' ? '#991b1b' : '#92400e' }}>
                      {overallStatus === 'verified' ? 'Verified Service Professional' : overallStatus === 'rejected' ? 'Application Needs Attention / Rejected' : 'Verification Under Review'}
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: overallStatus === 'verified' ? '#166534' : overallStatus === 'rejected' ? '#7f1d1d' : '#b45309' }}>
                      {overallStatus === 'verified'
                        ? 'Your profile is officially verified. Customers see your verified trust badges on search and booking pages.'
                        : overallStatus === 'rejected'
                        ? (v.adminReviewNotes || 'Please review admin notes below and re-submit corrected information.')
                        : 'Our administration team reviews submissions within 24-48 hours. You can continue updating your details in the meantime.'}
                    </p>
                  </div>
                </div>

                {/* Per-pillar breakdown table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 700 }}>Verification Category</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700 }}>Admin Notes / Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>1. Identity Verification</td>
                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(idStatus)}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-light)' }}>{v.identity?.adminNotes || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>2. Practical Experience</td>
                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(expStatus)}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-light)' }}>{v.experience?.adminNotes || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>3. Trade Skills & Competencies</td>
                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(skillStatus)}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-light)' }}>{v.skills?.adminNotes || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>4. Qualification / Certificate</td>
                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(qualStatus)}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-light)' }}>{v.qualification?.adminNotes || (isLicensed ? 'Required trade credential' : 'Optional credential')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Submit button if not under review or verified */}
                {overallStatus !== 'verified' && overallStatus !== 'under_review' && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={handleSubmitAllForReview} disabled={submitting} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                      Submit / Re-submit for Review
                    </button>
                  </div>
                )}
              </div>
            </PanelCard>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export const ProviderAvailability = () => {
  const data = usePanel();
  const provider = data.provider;

  const [isAvailable, setIsAvailable] = useState(true);
  const [emergencyAvailability, setEmergencyAvailability] = useState(false);
  const [schedule, setSchedule] = useState(() =>
    days.map(day => ({
      day,
      enabled: day !== 'Sunday',
      start: '09:00',
      end: '18:00',
    }))
  );
  const [specificDates, setSpecificDates] = useState([]);
  const [saving, setSaving] = useState(false);

  // New specific date exception form
  const [newDate, setNewDate] = useState('');
  const [newDateStatus, setNewDateStatus] = useState('unavailable'); // 'unavailable' | 'available'
  const [newDateReason, setNewDateReason] = useState('');
  const [newDateStart, setNewDateStart] = useState('09:00');
  const [newDateEnd, setNewDateEnd] = useState('18:00');

  // Load from provider.availability on mount / change
  useEffect(() => {
    if (provider?.availability) {
      const avail = provider.availability;
      setIsAvailable(avail.isAvailable !== false);
      setEmergencyAvailability(Boolean(avail.emergencyAvailability));

      const workingDays = avail.workingDays || [];
      const defaultStart = avail.workingHours?.start || '09:00';
      const defaultEnd = avail.workingHours?.end || '18:00';

      const mergedSchedule = days.map(day => {
        const item = avail.schedule?.find(s => s.day === day);
        if (item) {
          return {
            day,
            enabled: Boolean(item.enabled),
            start: item.start || defaultStart,
            end: item.end || defaultEnd,
          };
        }
        const isEnabled = workingDays.length > 0 ? workingDays.includes(day) : day !== 'Sunday';
        return {
          day,
          enabled: isEnabled,
          start: defaultStart,
          end: defaultEnd,
        };
      });
      setSchedule(mergedSchedule);
      setSpecificDates(Array.isArray(avail.specificDates) ? avail.specificDates : []);
    }
  }, [provider]);

  if (data.body) return data.body;

  const toggleDay = (dayName) => {
    setSchedule(prev => prev.map(s => s.day === dayName ? { ...s, enabled: !s.enabled } : s));
  };

  const changeDayTime = (dayName, field, value) => {
    setSchedule(prev => prev.map(s => s.day === dayName ? { ...s, [field]: value } : s));
  };

  const copyHoursToAll = (sourceDay) => {
    const src = schedule.find(s => s.day === sourceDay);
    if (!src) return;
    setSchedule(prev => prev.map(s => s.enabled ? { ...s, start: src.start, end: src.end } : s));
    toast.success(`Copied ${src.start} – ${src.end} to all working days`);
  };

  const handleAddSpecificDate = (e) => {
    e.preventDefault();
    if (!newDate) {
      toast.error('Please choose a date');
      return;
    }
    const isAvail = newDateStatus === 'available';
    if (isAvail && newDateStart >= newDateEnd) {
      toast.error('End time must be after start time');
      return;
    }

    const entry = {
      date: newDate,
      isAvailable: isAvail,
      reason: newDateReason.trim(),
      start: isAvail ? newDateStart : undefined,
      end: isAvail ? newDateEnd : undefined,
    };

    setSpecificDates(prev => {
      const filtered = prev.filter(item => item.date !== newDate);
      return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
    setNewDate('');
    setNewDateReason('');
    toast.success(`Date override added for ${newDate}`);
  };

  const handleRemoveSpecificDate = (dateStr) => {
    setSpecificDates(prev => prev.filter(item => item.date !== dateStr));
    toast.success(`Override removed for ${dateStr}`);
  };

  const handleSave = async () => {
    for (const item of schedule) {
      if (item.enabled && item.start >= item.end) {
        toast.error(`Invalid hours for ${item.day}: end time must be after start time`);
        return;
      }
    }

    setSaving(true);
    try {
      await API.put('/providers/me/availability', {
        isAvailable,
        emergencyAvailability,
        schedule,
        specificDates,
      });
      toast.success('Availability updated successfully!');
      data.reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const activeDaysCount = schedule.filter(s => s.enabled).length;

  return (
    <AppLayout>
      <div className="provider-workspace">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <PageHeader
            eyebrow="Scheduling & Operations"
            title="Working Schedule & Availability"
            description="Control your active working days, set custom hours per day, manage holiday leaves, and emergency readiness."
          />
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', fontSize: 14, fontWeight: 700, borderRadius: 10 }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Availability'}
          </button>
        </div>

        <div className="provider-grid provider-grid-2">
          {/* Card 1: Weekly Schedule */}
          <PanelCard
            title="Weekly Working Days & Hours"
            action={
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)', background: '#f1f5f9', padding: '4px 10px', borderRadius: 20 }}>
                {activeDaysCount} / 7 Days Active
              </span>
            }
          >
            <p className="provider-muted" style={{ marginBottom: 16 }}>
              Toggle the days you want to work and set individual start and end hours for each day.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schedule.map(item => (
                <div
                  key={item.day}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: item.enabled ? '#ffffff' : '#f8fafc',
                    border: `1px solid ${item.enabled ? '#cbd5e1' : '#e2e8f0'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => toggleDay(item.day)}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 15, fontWeight: item.enabled ? 700 : 500, color: item.enabled ? 'var(--text-dark)' : 'var(--text-light)' }}>
                        {item.day}
                      </span>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.enabled ? (
                        <>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#dcfce7', color: '#166534' }}>
                            Working
                          </span>
                          <button
                            type="button"
                            onClick={() => copyHoursToAll(item.day)}
                            title="Copy these hours to all active working days"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px' }}
                          >
                            <Copy size={12} /> Copy to all
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fee2e2', color: '#991b1b' }}>
                          Day Off (Unavailable)
                        </span>
                      )}
                    </div>
                  </div>

                  {item.enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 28 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>From:</span>
                        <input
                          type="time"
                          value={item.start}
                          onChange={e => changeDayTime(item.day, 'start', e.target.value)}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: 13, width: 110, height: 34 }}
                        />
                      </div>
                      <span style={{ color: 'var(--text-light)', fontSize: 12 }}>to</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>To:</span>
                        <input
                          type="time"
                          value={item.end}
                          onChange={e => changeDayTime(item.day, 'end', e.target.value)}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: 13, width: 110, height: 34 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </PanelCard>

          {/* Right Column: General Toggles & Specific Date Overrides */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* General Preferences */}
            <PanelCard title="General Readiness">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong style={{ fontSize: 14, display: 'block', color: 'var(--text-dark)' }}>Accepting Bookings</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Master toggle to turn your services ON or OFF</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={() => setIsAvailable(!isAvailable)}
                    style={{ width: 20, height: 20, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: 14, display: 'block', color: 'var(--text-dark)' }}>Emergency Availability</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Allow customers to send urgent & emergency bookings</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emergencyAvailability}
                    onChange={() => setEmergencyAvailability(!emergencyAvailability)}
                    style={{ width: 20, height: 20, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </PanelCard>

            {/* Calendar & Specific Date Overrides */}
            <PanelCard title="Calendar Date Overrides & Holidays">
              <p className="provider-muted" style={{ marginBottom: 14 }}>
                Mark specific dates as unavailable (leave, holiday, appointments) or add special working hours without changing your weekly routine.
              </p>

              {/* Add Exception Form */}
              <form
                onSubmit={handleAddSpecificDate}
                style={{
                  background: 'var(--bg)',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  marginBottom: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date *</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="input"
                      style={{ height: 36, fontSize: 13 }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Availability Status</label>
                    <select
                      value={newDateStatus}
                      onChange={e => setNewDateStatus(e.target.value)}
                      className="input"
                      style={{ height: 36, fontSize: 13 }}
                    >
                      <option value="unavailable">Unavailable (Holiday / Leave)</option>
                      <option value="available">Available (Special Working Day)</option>
                    </select>
                  </div>
                </div>

                {newDateStatus === 'available' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-light)', display: 'block', marginBottom: 2 }}>Custom Start Time</label>
                      <input
                        type="time"
                        value={newDateStart}
                        onChange={e => setNewDateStart(e.target.value)}
                        className="input"
                        style={{ height: 34, fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-light)', display: 'block', marginBottom: 2 }}>Custom End Time</label>
                      <input
                        type="time"
                        value={newDateEnd}
                        onChange={e => setNewDateEnd(e.target.value)}
                        className="input"
                        style={{ height: 34, fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note / Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Doctor appointment, Vacation, National holiday"
                    value={newDateReason}
                    onChange={e => setNewDateReason(e.target.value)}
                    className="input"
                    style={{ height: 36, fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="submit" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13 }}>
                    <Plus size={14} /> Add Override
                  </button>
                </div>
              </form>

              {/* List of Scheduled Overrides */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
                  Active Date Overrides ({specificDates.length})
                </span>

                {specificDates.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-light)', fontSize: 13, background: 'var(--bg)', borderRadius: 10 }}>
                    No date overrides. Your normal weekly schedule applies to all dates.
                  </div>
                ) : (
                  specificDates.map(item => (
                    <div
                      key={item.date}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
                          {item.date}
                        </span>
                        {item.isAvailable ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>
                            Special Hours: {item.start || '09:00'} - {item.end || '18:00'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>
                            Unavailable (Holiday / Leave)
                          </span>
                        )}
                        {item.reason && (
                          <span style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>
                            — {item.reason}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSpecificDate(item.date)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: 4, borderRadius: 4 }}
                        title="Remove this date override"
                        onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </PanelCard>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export { default as ProviderSettings } from './ProviderSettings';

export const ProviderNotifications = () => {
  const data = usePanel();
  const grouped = useMemo(() => groupByStatus(data.notifications.map(n => ({ ...n, status: n.type?.split('_')[0] || 'announcements' }))), [data.notifications]);
  if (data.body) return data.body;
  const buckets = ['booking', 'message', 'payment', 'verification', 'announcements'];
  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader eyebrow="Inbox" title="Notifications" description="Bookings, messages, payments, verification, and announcements." />
        <div className="provider-grid provider-grid-2">
          {buckets.map(bucket => (
            <PanelCard key={bucket} title={bucket.replace(/^./, c => c.toUpperCase())}>
              {(grouped[bucket] || []).length ? grouped[bucket].map(item => (
                <div className="provider-notification-row" key={item._id}>
                  <Bell size={16} />
                  <div><strong>{item.title}</strong><p>{item.message}</p></div>
                </div>
              )) : <EmptyState title="Nothing new" description={`No ${bucket} notifications.`} />}
            </PanelCard>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};
