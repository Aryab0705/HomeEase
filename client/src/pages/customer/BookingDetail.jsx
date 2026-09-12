import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, MapPin, MessageSquare, Star, AlertTriangle, CheckCircle, XCircle, Clock, Navigation } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import StarRating from '../../components/common/StarRating';
import Modal from '../../components/common/Modal';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { formatDate, formatCurrency, CATEGORY_ICONS, timeAgo } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { getSocket, initSocket } from '../../services/socket';

const STATUS_FLOW = ['pending', 'accepted', 'on_the_way', 'arrived', 'site_visit_completed', 'settled'];

const STATUS_MESSAGES = {
  pending: 'Booking is pending confirmation and site visit fee payment.',
  accepted: 'Your booking has been accepted by the provider.',
  rejected: 'Your booking was rejected by the provider.',
  on_the_way: 'Your provider is on the way.',
  arrived: 'Your provider has arrived at the destination.',
  site_visit_completed: 'Site visit completed. Customer and provider discuss project details offline.',
  customer_decision: 'Customer has recorded their project decision.',
  settled: 'Site visit consultation fee has been settled.',
  completed: 'Your service booking has been completed.',
  cancelled: 'Your booking has been cancelled.',
};

// ── Review configuration ─────────────────────────────────────────────────────
// The four detailed rating categories the customer selects (1–5 stars each).
// overallRating is auto-calculated as their average — NOT selectable.
const REVIEW_CATEGORIES = [
  { key: 'workQuality',     label: 'Work Quality',    legacy: 'quality' },
  { key: 'punctuality',     label: 'Punctuality',     legacy: 'timeliness' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'valueForMoney',   label: 'Value for Money', legacy: 'communication' },
];

// For display purposes (existing reviews), includes overallRating
const ALL_REVIEW_CATEGORIES = [
  { key: 'overallRating',   label: 'Overall Rating' },
  ...REVIEW_CATEGORIES,
];

/** Canonical value first, then the legacy field, then zero. */
const categoryScore = (ratings, category) =>
  ratings?.[category.key] ?? (category.legacy ? ratings?.[category.legacy] : undefined) ?? 0;

const MIN_REVIEW_LENGTH = 10;
const MAX_REVIEW_LENGTH = 1000;

// Every rating starts at 0 — i.e. all stars render EMPTY.
const EMPTY_REVIEW = Object.freeze({
  workQuality: 0,
  punctuality: 0,
  professionalism: 0,
  valueForMoney: 0,
  comment: '',
});

const BookingDetail = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user, token }  = useSelector(s => s.auth);
  const [booking, setBooking]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewData, setReviewData]   = useState({ ...EMPTY_REVIEW });
  const [reviewErrors, setReviewErrors] = useState({});
  const [myReview, setMyReview]       = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [isTracking, setIsTracking]   = useState(false);
  const [providerLoc, setProviderLoc] = useState(null);
  const [payingFee, setPayingFee] = useState(false);
  const [completingVisit, setCompletingVisit] = useState(false);
  const [recordingDecision, setRecordingDecision] = useState(false);
  const bookingRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await API.get(`/bookings/${id}`);
      const bData = res.data.data;
      setBooking(bData);
      bookingRef.current = bData;
      if (bData?.isLiveTracking) setIsTracking(true);
      if (bData?.currentProviderLocation) setProviderLoc(bData.currentProviderLocation);
    } catch { toast.error('Booking not found'); navigate(-1); }
    finally  { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  // Fetch the review attached to this booking (if any)
  const loadMyReview = useCallback(async () => {
    if (!id) return;
    try {
      const res = await API.get(`/reviews/booking/${id}`);
      setMyReview(res.data.data?.review ?? null);
    } catch (err) {
      if (err?.response?.status && err.response.status !== 403 && err.response.status !== 404) {
        console.error('[Review] Could not load booking review:', err?.response?.data || err.message);
      }
      setMyReview(null);
    }
  }, [id]);

  useEffect(() => {
    if (['completed', 'settled'].includes(booking?.status)) loadMyReview();
  }, [booking?.status, loadMyReview]);

  // Real-time Socket.IO status and GPS location update listener
  useEffect(() => {
    if (!id) return;

    let socketInstance = getSocket();
    if (!socketInstance && token) {
      socketInstance = initSocket(token);
    }

    if (socketInstance) {
      socketInstance.emit('join_booking', { bookingId: id });
      socketInstance.emit('join_booking', id);
      socketInstance.emit('joinBooking', id);

      const handleStatusUpdated = (data) => {
        const targetBookingId = data?.bookingId || data?.booking?._id;
        if (String(targetBookingId) !== String(id)) return;

        const nextStatus = data.status || data.booking?.status;
        if (!nextStatus) return;

        setBooking(prev => {
          if (!prev) return prev;
          const nextHistory = prev.statusHistory ? [...prev.statusHistory] : [];
          if (!nextHistory.some(h => h.status === nextStatus)) {
            nextHistory.push({ status: nextStatus, changedAt: data.updatedAt || new Date() });
          }
          const updated = {
            ...prev,
            ...(data.booking || {}),
            status: nextStatus,
            updatedAt: data.updatedAt || new Date(),
            statusHistory: nextHistory,
          };
          bookingRef.current = updated;
          return updated;
        });

        const notifMsg = STATUS_MESSAGES[nextStatus] || `Booking status updated to ${nextStatus.replace('_', ' ')}`;
        toast.success(notifMsg, { id: `status-${nextStatus}` });
      };

      const calculateHaversine = (lat1, lon1, lat2, lon2) => {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
        const R = 6371; // km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;
        return {
          distanceKm: Number(distanceKm.toFixed(2)),
          distanceMeters: Math.round(distanceKm * 1000),
        };
      };

      const handleLocationUpdate = (data) => {
        console.log("RECEIVED PROVIDER LOCATION", data);
        const targetId = data?.bookingId || data?.booking?._id;
        if (String(targetId) !== String(id)) return;

        const provLat = data.latitude ?? data.lat ?? data.location?.lat;
        const provLng = data.longitude ?? data.lng ?? data.location?.lng;

        if (provLat != null && provLng != null) {
          // Use server-sent customerDestination first (most reliable, avoids stale closure)
          // Then fall back to bookingRef.current (fresh ref, not stale closure)
          const b = bookingRef.current;
          const custLat = data.customerDestination?.latitude
            ?? b?.customerLocation?.latitude
            ?? b?.address?.coordinates?.lat;
          const custLng = data.customerDestination?.longitude
            ?? b?.customerLocation?.longitude
            ?? b?.address?.coordinates?.lng;

          console.log("CUSTOMER DESTINATION:", { latitude: custLat, longitude: custLng });
          console.log("PROVIDER LIVE LOCATION:", { latitude: provLat, longitude: provLng });

          // Prefer server-calculated distance, fallback to client haversine
          let distObj = null;
          if (data.distanceKm != null) {
            distObj = { distanceKm: data.distanceKm, distanceMeters: data.distanceMeters ?? Math.round(data.distanceKm * 1000) };
          } else if (custLat != null && custLng != null) {
            distObj = calculateHaversine(provLat, provLng, custLat, custLng);
          }

          console.log("CALCULATED DISTANCE:", distObj ? `${distObj.distanceKm} km` : "Unavailable");

          setProviderLoc({
            lat: provLat,
            lng: provLng,
            accuracy: data.accuracy || null,
            distanceKm: distObj?.distanceKm ?? null,
            distanceMeters: distObj?.distanceMeters ?? null,
            status: data.status || null,
            updatedAt: data.timestamp || data.location?.updatedAt || new Date().toISOString(),
          });
        }
      };

      socketInstance.on('booking:statusUpdated', handleStatusUpdated);
      socketInstance.on('status_updated', handleStatusUpdated);
      socketInstance.on('provider_location_updated', handleLocationUpdate);
      socketInstance.on('provider_location', handleLocationUpdate);

      return () => {
        socketInstance.off('booking:statusUpdated', handleStatusUpdated);
        socketInstance.off('status_updated', handleStatusUpdated);
        socketInstance.off('provider_location_updated', handleLocationUpdate);
        socketInstance.off('provider_location', handleLocationUpdate);
      };
    }
  }, [id, token]);

  // Real-time Provider Live GPS Location Tracking using Geolocation API
  // Only active when provider has manually started journey ('on_the_way')
  useEffect(() => {
    if (user?.role !== 'provider' || !id) return;
    if (booking?.status !== 'on_the_way') {
      setIsTracking(false);
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log("GPS SUCCESS", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });

        const socketInstance = getSocket();
        if (socketInstance) {
          const payload = {
            bookingId: id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          };
          console.log("EMITTING PROVIDER LOCATION", payload);
          socketInstance.emit('provider_location_update', payload);
        }
      },
      (error) => {
        console.error("GPS ERROR", {
          code: error.code,
          message: error.message,
        });
        const errMap = {
          1: 'PERMISSION_DENIED: Please allow location access in your browser.',
          2: 'POSITION_UNAVAILABLE: Location info is unavailable.',
          3: 'TIMEOUT: Geolocation request timed out.',
        };
        toast.error(errMap[error.code] || `GPS Error: ${error.message}`, { id: 'gps-error' });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsTracking(false);
    };
  }, [user?.role, id, booking?.status]);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      await API.patch(`/bookings/${id}/cancel`, { reason: cancelReason?.trim() || undefined });
      toast.success('Booking cancelled');
      setCancelModal(false);
      setCancelReason('');
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Cannot cancel'); }
    finally { setSubmitting(false); }
  };

  // Razorpay Payment for Site Visit Fee
  const handlePayConsultationFee = async () => {
    setPayingFee(true);
    try {
      const orderRes = await API.post(`/bookings/${id}/create-order`);
      const { orderId, amount, currency, keyId, isMock, consultationFee } = orderRes.data.data;

      // Check if Razorpay script is loaded
      const loadRazorpayScript = () => {
        return new Promise((resolve) => {
          if (window.Razorpay) return resolve(true);
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || isMock) {
        // Test / Mock Mode fallback or environment without live Razorpay keys
        const verifyRes = await API.post(`/bookings/${id}/verify-payment`, {
          razorpayOrderId: orderId,
          razorpayPaymentId: 'pay_mock_' + Date.now(),
          razorpaySignature: 'mock_verified_sig',
        });
        toast.success(`Site Visit Fee of ₹${consultationFee} paid successfully!`);
        load();
        return;
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: 'HomeEase Services',
        description: `Site Visit / Consultation Fee for ${booking?.serviceId?.name || 'Service'}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await API.post(`/bookings/${id}/verify-payment`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success(`Site Visit Fee of ₹${consultationFee} paid successfully!`);
            load();
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Payment verification failed');
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone,
        },
        theme: { color: '#2563eb' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not initiate payment');
    } finally {
      setPayingFee(false);
    }
  };

  // Provider: Complete Site Visit
  const handleCompleteSiteVisit = async () => {
    setCompletingVisit(true);
    try {
      await API.patch(`/bookings/${id}/complete-visit`);
      toast.success('Site Visit marked completed! Discuss project terms offline with customer.');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete site visit');
    } finally {
      setCompletingVisit(false);
    }
  };

  // Customer: Record Decision (PROCEED / NOT_PROCEED)
  const handleRecordCustomerDecision = async (decision) => {
    setRecordingDecision(true);
    try {
      await API.patch(`/bookings/${id}/decision`, { decision });
      if (decision === 'PROCEED') {
        toast.success('You chose to proceed with this provider offline!');
      } else {
        toast.success('Decision recorded. Site visit completed.');
      }
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record decision');
    } finally {
      setRecordingDecision(false);
    }
  };

  // ── Review validation ──────────────────────────────────────────────────────
  // Recomputed on every keystroke / star click so the Submit button and the
  // inline messages stay in sync with what the backend will accept.
  const reviewValidation = useMemo(() => {
    const errors = {};

    REVIEW_CATEGORIES.forEach(({ key, label }) => {
      const v = Number(reviewData[key]);
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        errors[key] = `Select a ${label.toLowerCase()} between 1 and 5 stars.`;
      }
    });

    const text = (reviewData.comment || '').trim();
    if (!text) {
      errors.comment = 'Please write a short review before submitting.';
    } else if (text.length < MIN_REVIEW_LENGTH) {
      errors.comment = `A little more detail please — ${text.length}/${MIN_REVIEW_LENGTH} characters minimum.`;
    } else if (text.length > MAX_REVIEW_LENGTH) {
      errors.comment = `Your review is too long — ${text.length}/${MAX_REVIEW_LENGTH} characters maximum.`;
    }

    return errors;
  }, [reviewData]);

  const isReviewValid = Object.keys(reviewValidation).length === 0;

  const closeReviewModal = () => {
    setReviewModal(false);
    setReviewErrors({});
  };

  const handleReview = async () => {
    // Belt-and-braces: the button is disabled, but never trust the UI alone.
    if (!isReviewValid) {
      setReviewErrors(reviewValidation);
      toast.error('Please rate every category and write a short review.');
      return;
    }

    // overallRating is NOT sent — the server computes it from the four ratings
    const payload = {
      bookingId: id,
      ratings: {
        workQuality:     reviewData.workQuality,
        punctuality:     reviewData.punctuality,
        professionalism: reviewData.professionalism,
        valueForMoney:   reviewData.valueForMoney,
      },
      comment: reviewData.comment.trim(),
    };

    setSubmitting(true);
    try {
      const res = await API.post('/reviews', payload);
      const created = res.data?.data?.review ?? res.data?.data ?? null;

      // Update local state immediately — no page refresh required.
      setMyReview(created);
      setBooking(prev => (prev ? { ...prev, isReviewed: true } : prev));
      setReviewData({ ...EMPTY_REVIEW });
      setReviewErrors({});
      setReviewModal(false);
      toast.success('Review submitted. Thanks for the feedback!');

      // Re-sync from the server in the background so the booking and the
      // stored review are authoritative.
      loadMyReview();
      load();
    } catch (err) {
      const response = err?.response;

      // Surface the REAL backend failure to the developer console — never
      // swallow it behind a generic message.
      console.error('[Review submit failed]', {
        status: response?.status,
        message: response?.data?.message,
        validationErrors: response?.data?.errors,
        payloadSent: payload,
        raw: response?.data ?? err.message,
      });

      // Map express-validator field errors back onto the form.
      const fieldErrors = {};
      (response?.data?.errors || []).forEach((e) => {
        const path = (e.path || e.param || '').replace(/^ratings\./, '');
        if (path) fieldErrors[path] = e.msg || e.message;
      });
      setReviewErrors(fieldErrors);

      // Clean, human-readable message in the UI.
      toast.error(
        response?.data?.message ||
        (response?.status === 409 ? 'You have already reviewed this booking.' : null) ||
        'Could not submit your review. Please try again.'
      );

      // If the booking was already reviewed, reconcile the UI with reality.
      if (response?.status === 409) {
        setReviewModal(false);
        loadMyReview();
        load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openChat = async () => {
    try {
      const res = await API.post('/chats/initiate', { bookingId: id });
      navigate(`/chat/${res.data.data._id}`);
    } catch { toast.error('Could not open chat'); }
  };

  if (loading) return <AppLayout><PageSpinner /></AppLayout>;
  if (!booking) return null;

  const b = booking;
  const stepIndex = STATUS_FLOW.indexOf(b.status);
  const canCancel = ['pending', 'accepted'].includes(b.status) && user?.role === 'customer';
  // Hidden once a review exists — enforced independently by the backend too.
  const canReview = b.status === 'completed' && user?.role === 'customer' && !myReview && !b.isReviewed;

  return (
    <AppLayout>
          {/* Back */}
          <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm" style={{ marginBottom: 20, gap: 6 }}>
            <ArrowLeft size={15} /> Back
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Main card */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
                    {CATEGORY_ICONS[b.serviceId?.category] || '🔧'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 22, marginBottom: 6 }}>{b.serviceId?.name}</h1>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <StatusBadge status={b.status} />
                      <span className="badge badge-gray">{b.serviceId?.category}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {!['cancelled', 'rejected'].includes(b.status) && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      {STATUS_FLOW.map((s, i) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_FLOW.length - 1 ? 1 : 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: i <= stepIndex ? 'var(--dark-accent)' : 'var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.3s',
                          }}>
                            {i < stepIndex ? <CheckCircle size={14} color="white" /> :
                             i === stepIndex ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} /> :
                             <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1' }} />}
                          </div>
                          {i < STATUS_FLOW.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: i < stepIndex ? 'var(--dark-accent)' : 'var(--border)', transition: 'background 0.3s' }} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      {STATUS_FLOW.map(s => (
                        <span key={s} style={{ fontSize: 10, color: 'var(--text-light)', textAlign: 'center', textTransform: 'capitalize' }}>
                          {s.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid-2" style={{ gap: 16 }}>
                  {[
                    { label: 'Scheduled Date', value: formatDate(b.scheduledDate), icon: <Calendar size={14} /> },
                    { label: 'Scheduled Time', value: b.scheduledTimeSlot?.start ? `${b.scheduledTimeSlot.start}${b.scheduledTimeSlot.end ? ' – ' + b.scheduledTimeSlot.end : ''}` : 'Flexible', icon: <Clock size={14} /> },
                    { label: 'Address', value: b.address ? `${b.address.street}, ${b.address.city}` : 'N/A', icon: <MapPin size={14} /> },
                    { label: 'Booking Created', value: timeAgo(b.createdAt), icon: <Clock size={14} /> },
                  ].map(d => (
                    <div key={d.label} style={{ padding: 14, background: 'var(--bg)', borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {d.icon} {d.label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{d.value}</div>
                    </div>
                  ))}
                </div>

                {b.problemDescription && (
                  <div style={{ marginTop: 16, padding: 14, background: 'var(--bg)', borderRadius: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600, marginBottom: 4 }}>PROBLEM DESCRIPTION</p>
                    <p style={{ fontSize: 14 }}>{b.problemDescription}</p>
                  </div>
                )}

                {/* Provider Live Location Tracking Card */}
                {!['cancelled', 'rejected'].includes(b.status) && (
                  <div style={{ marginTop: 20, padding: 18, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={18} color="var(--dark-accent)" />
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Provider Live Location</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: providerLoc ? '#dcfce7' : '#f1f5f9', color: providerLoc ? '#166534' : '#64748b', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: providerLoc ? '#22c55e' : '#94a3b8', animation: providerLoc ? 'pulse 1.5s infinite' : 'none' }} />
                        {providerLoc ? 'Live' : 'Waiting for Provider GPS'}
                      </div>
                    </div>

                    <div className="grid-2" style={{ gap: 12 }}>
                      <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Provider Coordinates</div>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
                          {providerLoc?.lat != null && providerLoc?.lng != null ? `${Number(providerLoc.lat).toFixed(4)}, ${Number(providerLoc.lng).toFixed(4)}` : (b.currentProviderLocation?.lat != null ? `${Number(b.currentProviderLocation.lat).toFixed(4)}, ${Number(b.currentProviderLocation.lng).toFixed(4)}` : 'Not available yet')}
                        </div>
                      </div>

                      <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Destination Address</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {b.address?.street ? `${b.address.street}, ${b.address.city}` : 'Customer Address'}
                          {(b.customerLocation?.latitude || b.address?.coordinates?.lat) && (
                            <span style={{ fontSize: 11, display: 'block', color: 'var(--text-light)', fontFamily: 'monospace' }}>
                              ({(b.customerLocation?.latitude || b.address?.coordinates?.lat).toFixed(4)}, {(b.customerLocation?.longitude || b.address?.coordinates?.lng).toFixed(4)})
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Distance from Destination</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark-accent)' }}>
                          {providerLoc?.distanceKm != null
                            ? `${providerLoc.distanceKm} km (${providerLoc.distanceMeters ?? Math.round(providerLoc.distanceKm * 1000)} m)`
                            : (!b.customerLocation?.latitude && !b.address?.coordinates?.lat)
                            ? 'Destination location unavailable'
                            : 'Calculating...'}
                        </div>
                      </div>

                      <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Tracking Status & Last Update</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          Status: <span style={{ textTransform: 'uppercase', color: '#2563eb' }}>{providerLoc?.status || b.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                          {providerLoc?.updatedAt ? timeAgo(providerLoc.updatedAt) : 'No updates received yet'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Work images */}
              {(b.beforeWorkImages?.length > 0 || b.afterWorkImages?.length > 0) && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 16 }}>Work Photos</h3>
                  {b.beforeWorkImages?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', marginBottom: 8 }}>BEFORE</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {b.beforeWorkImages.map((img, i) => <img key={i} src={img.url} alt="before" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10 }} />)}
                      </div>
                    </div>
                  )}
                  {b.afterWorkImages?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', marginBottom: 8 }}>AFTER</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {b.afterWorkImages.map((img, i) => <img key={i} src={img.url} alt="after" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10 }} />)}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Submitted review — visible to the customer who wrote it and
                  to the provider on this booking. */}
              {myReview && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                        {user?.role === 'provider' ? 'Customer Review' : 'Your Review'}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
                        Submitted {timeAgo(myReview.createdAt)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StarRating rating={myReview.overallRating} size={18} />
                      <span style={{ fontSize: 15, fontWeight: 700 }}>
                        {Number(myReview.overallRating || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: 10, marginBottom: 16 }}>
                    {REVIEW_CATEGORIES.map(c => (
                      <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{c.label}</span>
                        <StarRating rating={categoryScore(myReview.ratings, c)} size={14} />
                      </div>
                    ))}
                  </div>

                  {myReview.comment && (
                    <p style={{ fontSize: 14, lineHeight: 1.6, padding: 14, background: 'var(--bg)', borderRadius: 10 }}>
                      “{myReview.comment}”
                    </p>
                  )}

                  {myReview.providerResponse?.comment && (
                    <div style={{ marginTop: 12, padding: 14, borderLeft: '3px solid var(--dark-accent)', background: '#f8fafc', borderRadius: '0 10px 10px 0' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark-accent)', marginBottom: 4 }}>
                        Provider replied
                      </p>
                      <p style={{ fontSize: 13, lineHeight: 1.6 }}>{myReview.providerResponse.comment}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Actions & Provider Status Controls */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Provider status transition buttons */}
                {user?.role === 'provider' && (
                  <>
                    {b.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          style={{ background: '#22c55e', borderColor: '#22c55e' }}
                          disabled={submitting}
                          onClick={async () => {
                            setSubmitting(true);
                            try {
                              await API.patch(`/bookings/${id}/status`, { status: 'accepted' });
                              toast.success('Booking accepted!');
                              load();
                            } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
                            finally { setSubmitting(false); }
                          }}
                        >
                          Accept Booking
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                          disabled={submitting}
                          onClick={async () => {
                            setSubmitting(true);
                            try {
                              await API.patch(`/bookings/${id}/status`, { status: 'rejected' });
                              toast.error('Booking rejected');
                              load();
                            } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
                            finally { setSubmitting(false); }
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {b.status === 'accepted' && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button
                          className="btn btn-primary"
                          style={{ background: '#2563eb', borderColor: '#2563eb', gap: 6 }}
                          disabled={submitting}
                          onClick={async () => {
                            // Check scheduled time client-side as well
                            const now = new Date();
                            const schedDate = new Date(b.scheduledDate);
                            const startSlot = b.scheduledTimeSlot?.start;
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
                              toast.error(`Cannot start journey before scheduled time (${formattedDate} at ${formattedEarliest}). Future bookings remain ACCEPTED until scheduled time.`);
                              return;
                            }

                            setSubmitting(true);
                            try {
                              await API.patch(`/bookings/${id}/status`, {
                                status: 'on_the_way',
                                note: 'Provider manually started journey',
                              });
                              toast.success('Journey started! Live GPS tracking active.');
                              load();
                            } catch (e) {
                              toast.error(e?.response?.data?.message || 'Failed to start journey');
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          <Navigation size={16} /> {submitting ? 'Starting...' : 'Start Journey / On The Way'}
                        </button>
                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                          Click when you start heading to customer address.
                        </span>
                      </div>
                    )}

                    {b.status === 'on_the_way' && (
                      <div style={{ padding: '8px 16px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', animation: 'pulse 1.5s infinite' }} />
                        Automatic Live GPS Location Tracking Active (En route to destination... Arrived will auto-trigger upon reaching within 100m)
                      </div>
                    )}

                    {b.status === 'arrived' && (
                      <button
                        className="btn btn-primary"
                        style={{ background: '#22c55e', borderColor: '#22c55e', gap: 6 }}
                        disabled={completingVisit}
                        onClick={handleCompleteSiteVisit}
                      >
                        <CheckCircle size={16} /> {completingVisit ? 'Completing...' : 'Complete Site Visit'}
                      </button>
                    )}

                    {b.status === 'site_visit_completed' && (
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13, fontWeight: 600 }}>
                        ✓ Site Visit Completed. Discuss quotation offline with customer. Awaiting customer decision.
                      </div>
                    )}

                    {b.status === 'settled' && (
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', fontSize: 13, fontWeight: 600 }}>
                        ✓ Site Visit Consultation Fee Settled to Your Account.
                      </div>
                    )}
                  </>
                )}

                {b.providerId && <button className="btn btn-outline" onClick={openChat} style={{ gap: 8 }}><MessageSquare size={16} /> Message Provider</button>}
                {canReview  && <button className="btn btn-primary" onClick={() => setReviewModal(true)} style={{ gap: 8 }}><Star size={16} /> Write Review</button>}
                {canCancel  && <button className="btn btn-danger"  onClick={() => setCancelModal(true)}><XCircle size={16} /> Cancel Booking</button>}
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Provider */}
              {b.providerId && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Provider</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div className="avatar avatar-lg" style={{ background: 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)' }}>
                      {b.providerId?.userId?.name?.[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{b.providerId?.userId?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{b.providerId?.userId?.phone}</div>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={openChat}>
                    <MessageSquare size={14} /> Chat with Provider
                  </button>
                </motion.div>
              )}

              {/* Site Visit / Consultation Fee & Offline Discussion Card */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Site Visit & Consultation
                  </h3>
                  <span className="badge badge-primary" style={{ fontSize: 11 }}>
                    Official Model
                  </span>
                </div>

                {/* 1. Site Visit Fee Row */}
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>Site Visit Fee</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark-accent)' }}>
                      {formatCurrency(b.siteVisitFee || b.consultationFee || b.pricing?.consultationFee || b.estimatedAmount || b.totalAmount || 0)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Fee Status:</span>
                    {b.settlementStatus === 'REFUNDED' || b.pricing?.consultationFeeRefunded || b.paymentStatus === 'refunded' ? (
                      <span className="badge badge-danger" style={{ fontSize: 11 }}>Refunded ✓</span>
                    ) : b.pricing?.consultationFeePaid || b.paymentStatus === 'paid' ? (
                      <span className="badge badge-success" style={{ fontSize: 11 }}>Paid ✓</span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: 11 }}>Unpaid</span>
                    )}
                  </div>

                  {/* Customer Pay Button if Unpaid */}
                  {user?.role === 'customer' && !b.pricing?.consultationFeePaid && b.paymentStatus !== 'paid' && b.status !== 'cancelled' && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', marginTop: 8, background: '#2563eb', gap: 6 }}
                      disabled={payingFee}
                      onClick={handlePayConsultationFee}
                    >
                      💳 {payingFee ? 'Processing...' : `Pay ₹${b.siteVisitFee || b.consultationFee || b.pricing?.consultationFee || b.estimatedAmount || 0} Consultation Fee`}
                    </button>
                  )}

                  <div style={{ fontSize: 11, color: '#475569', marginTop: 8, lineHeight: 1.4, background: '#f1f5f9', padding: '6px 8px', borderRadius: 6 }}>
                    ℹ The consultation fee covers the provider's travel and on-site inspection. Project pricing and scope are discussed <strong>offline</strong>.
                  </div>
                </div>

                {/* 2. Arrival Evidence & Audit Trail */}
                {(b.providerArrivedAt || b.status === 'arrived' || b.status === 'site_visit_completed' || b.status === 'settled') && (
                  <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 14, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#166534', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={14} /> Arrival & Visit Verified
                    </div>
                    {b.arrivalDistanceMeters != null && (
                      <div style={{ color: '#166534' }}>
                        Distance at Arrival: <strong>{b.arrivalDistanceMeters}m</strong> (Geofence verified)
                      </div>
                    )}
                    {b.providerArrivedAt && (
                      <div style={{ color: '#4b5563', marginTop: 2 }}>
                        Arrived: {new Date(b.providerArrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {b.siteVisitCompletedAt && (
                      <div style={{ color: '#4b5563', marginTop: 2 }}>
                        Visit Completed: {new Date(b.siteVisitCompletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Customer Project Decision Card (When Site Visit is Completed) */}
                {b.status === 'site_visit_completed' && (
                  <div style={{ padding: '14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 14 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px 0', color: '#1e40af' }}>
                      Offline Project Discussion
                    </h4>
                    <p style={{ fontSize: 12, color: '#334155', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                      You and the provider have discussed the project quotation offline. Please record your decision below:
                    </p>

                    {user?.role === 'customer' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ background: '#16a34a', borderColor: '#16a34a', width: '100%', gap: 6 }}
                          disabled={recordingDecision}
                          onClick={() => handleRecordCustomerDecision('PROCEED')}
                        >
                          <CheckCircle size={15} /> {recordingDecision ? 'Saving...' : 'Proceed With Provider'}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: '#64748b', color: '#475569', width: '100%', gap: 6 }}
                          disabled={recordingDecision}
                          onClick={() => handleRecordCustomerDecision('NOT_PROCEED')}
                        >
                          <XCircle size={15} /> {recordingDecision ? 'Saving...' : 'Do Not Proceed'}
                        </button>
                        <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0', lineHeight: 1.3 }}>
                          *In both cases, the site visit fee is retained by the provider for the completed on-site consultation.
                        </p>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#1e40af', fontStyle: 'italic' }}>
                        Waiting for customer to submit their decision (Proceed / Do Not Proceed).
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Recorded Decision Confirmation Banner */}
                {b.customerDecision && (
                  <div style={{ padding: '12px', background: b.customerDecision === 'PROCEED' ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${b.customerDecision === 'PROCEED' ? '#bbf7d0' : '#e2e8f0'}`, marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: b.customerDecision === 'PROCEED' ? '#166534' : '#475569' }}>
                      Customer Decision: {b.customerDecision === 'PROCEED' ? 'Proceeding with Provider' : 'Not Proceeding'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      {b.customerDecision === 'PROCEED'
                        ? 'Project discussion agreed offline. Site visit fee settled to provider.'
                        : 'Project declined offline. Site visit fee settled to provider for completed visit.'}
                    </div>
                  </div>
                )}

                {/* 5. Settlement Notice */}
                {b.settlementStatus === 'PROVIDER_EARNED' && (
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={15} /> Site Visit Fee Earned & Settled
                  </div>
                )}
                {b.settlementStatus === 'REFUNDED' && (
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={15} /> Site Visit Fee Fully Refunded
                  </div>
                )}
              </motion.div>

              {/* Status log */}
              {b.statusHistory?.length > 0 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Timeline</h3>
                  {b.statusHistory.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dark-accent)', marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{h.status?.replace('_', ' ')}</div>
                        {h.note && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{h.note}</div>}
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{timeAgo(h.changedAt)}</div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModal}
        onClose={() => { setCancelModal(false); setCancelReason(''); }}
        title="Cancel Booking"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setCancelModal(false); setCancelReason(''); }} disabled={submitting}>
              Keep Booking
            </button>
            <button className="btn btn-danger" onClick={handleCancel} disabled={submitting}>
              {submitting ? 'Cancelling...' : 'Yes, Cancel'}
            </button>
          </>
        }
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <AlertTriangle size={38} color="var(--warning)" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>Are you sure you want to cancel this booking?</p>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 4 }}>
              {booking?.pricing?.consultationFeePaid
                ? 'Your Site Visit Fee will be automatically refunded to your original payment method.'
                : 'This action cannot be undone.'}
            </p>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label" style={{ fontSize: 13 }}>Reason for cancellation (optional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Why are you cancelling? (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>

      {/* Review Modal — every rating starts EMPTY (see EMPTY_REVIEW). */}
      <Modal
        isOpen={reviewModal}
        onClose={closeReviewModal}
        title="Write a Review"
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={closeReviewModal} disabled={submitting}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleReview}
              disabled={submitting || !isReviewValid}
              title={isReviewValid ? undefined : 'Rate every category and write at least 10 characters.'}
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── Auto-computed Overall Rating (read-only) ──────────────── */}
          {(() => {
            const vals = REVIEW_CATEGORIES.map(c => reviewData[c.key]).filter(v => v >= 1 && v <= 5);
            const allRated = vals.length === 4;
            const computed = allRated ? Math.round((vals.reduce((a, b) => a + b, 0) / 4) * 10) / 10 : null;
            return (
              <div style={{
                padding: '14px 16px',
                background: allRated ? '#f0fdf4' : '#f8fafc',
                borderRadius: 10,
                border: `1px solid ${allRated ? '#bbf7d0' : '#e2e8f0'}`,
                marginBottom: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 15, fontWeight: 700 }}>Overall Rating</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StarRating
                      value={computed || 0}
                      size={24}
                      label="Overall Rating"
                    />
                    <span style={{
                      fontSize: 16,
                      fontWeight: 700,
                      minWidth: 56,
                      textAlign: 'right',
                      color: allRated ? '#166534' : 'var(--text-light)',
                    }}>
                      {allRated ? `${computed} / 5` : '— / 5'}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                  {allRated
                    ? 'Calculated from your four ratings below.'
                    : 'Rate all four categories below to see your overall rating.'}
                </p>
              </div>
            );
          })()}

          {/* ── Four clickable detail ratings ──────────────────────────── */}
          {REVIEW_CATEGORIES.map(r => {
            const fieldError = reviewErrors[r.key];
            const chosen = reviewData[r.key];
            return (
              <div key={r.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 14, fontWeight: 500 }}>
                    {r.label} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StarRating
                      value={chosen}
                      interactive
                      label={r.label}
                      size={22}
                      onChange={v => {
                        setReviewData(prev => ({ ...prev, [r.key]: v }));
                        setReviewErrors(prev => {
                          if (!prev[r.key]) return prev;
                          const next = { ...prev };
                          delete next[r.key];
                          return next;
                        });
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        minWidth: 52,
                        textAlign: 'right',
                        fontWeight: chosen ? 600 : 400,
                        color: chosen ? 'var(--text-dark)' : 'var(--text-light)',
                      }}
                    >
                      {chosen ? `${chosen} / 5` : 'Not rated'}
                    </span>
                  </div>
                </div>
                {fieldError && (
                  <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldError}</p>
                )}
              </div>
            );
          })}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">
              Your Review <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className="input"
              rows={4}
              placeholder="Write your experience here..."
              maxLength={MAX_REVIEW_LENGTH}
              value={reviewData.comment}
              onChange={e => {
                const comment = e.target.value;
                setReviewData(p => ({ ...p, comment }));
                setReviewErrors(prev => {
                  if (!prev.comment) return prev;
                  const next = { ...prev };
                  delete next.comment;
                  return next;
                });
              }}
              style={{ resize: 'vertical', borderColor: reviewErrors.comment ? '#ef4444' : undefined }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: reviewErrors.comment ? '#ef4444' : 'var(--text-light)' }}>
                {reviewErrors.comment || `Minimum ${MIN_REVIEW_LENGTH} characters.`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                {reviewData.comment.trim().length}/{MAX_REVIEW_LENGTH}
              </span>
            </div>
          </div>

          {/* One clear, actionable message for whatever is still outstanding. */}
          {!isReviewValid && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '10px 12px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
              }}
            >
              <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                {Object.values(reviewValidation)[0]}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
};

export default BookingDetail;
