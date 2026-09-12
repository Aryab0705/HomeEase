import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CalendarPlus, CheckCircle2, AlertCircle, MapPin, Navigation, CreditCard } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import API from '../../services/api';
import toast from 'react-hot-toast';

const BookingCreate = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState({
    providerId: searchParams.get('providerId') || '',
    serviceId: searchParams.get('serviceId') || '',
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    timeStart: '10:00',
    timeEnd: '12:00',
    street: '',
    city: '',
    state: '',
    pincode: '',
    problemDescription: '',
  });

  const [proposedAmount, setProposedAmount] = useState('');
  const [proposalMessage, setProposalMessage] = useState('');

  const [customerLocCoords, setCustomerLocCoords] = useState(null);

  useEffect(() => {
    // Request browser geolocation permission to capture customer destination coordinates
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCustomerLocCoords(coords);
          console.log("CUSTOMER DESTINATION CAPTURED ON FORM:", coords);
        },
        (err) => {
          console.warn("Could not capture customer geolocation on booking form:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [serviceRes, providerRes] = await Promise.all([
          API.get('/services', { params: { limit: 100 } }),
          API.get('/providers', { params: { limit: 100 } }),
        ]);
        const serviceList = serviceRes.data.data?.services ?? [];
        const providerList = providerRes.data.data?.providers ?? [];
        setServices(serviceList);
        setProviders(providerList);

        let initialProviderId = searchParams.get('providerId') || '';
        let initialServiceId = searchParams.get('serviceId') || '';

        if (initialProviderId) {
          const prov = providerList.find((p) => p._id === initialProviderId);
          if (prov) {
            const matchingService = serviceList.find(
              (s) =>
                s.category === prov.primaryCategory ||
                (prov.subCategories || []).includes(s.category) ||
                (prov.services || []).some((ps) => ps.category === s.category)
            );
            if (matchingService && !initialServiceId) {
              initialServiceId = matchingService._id;
            }
          }
        }

        if (!initialServiceId && serviceList.length > 0) {
          initialServiceId = serviceList[0]._id;
        }

        if (initialServiceId) {
          const svc = serviceList.find((s) => s._id === initialServiceId);
          const validProviders = providerList.filter((p) => {
            const cats = [p.primaryCategory, ...(p.subCategories || []), ...(p.services || []).map((s) => s.category)];
            return cats.includes(svc?.category);
          });
          if (!validProviders.some((p) => p._id === initialProviderId)) {
            initialProviderId = validProviders[0]?._id || '';
          }
        }

        setForm((current) => ({
          ...current,
          serviceId: initialServiceId,
          providerId: initialProviderId,
        }));
      } catch {
        toast.error('Failed to load booking options');
      }
    };
    load();
  }, [searchParams]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleServiceChange = (newServiceId) => {
    const selectedSvc = services.find((s) => s._id === newServiceId);
    const validProviders = providers.filter((p) => {
      const cats = [p.primaryCategory, ...(p.subCategories || []), ...(p.services || []).map((s) => s.category)];
      return cats.includes(selectedSvc?.category);
    });

    setForm((prev) => ({
      ...prev,
      serviceId: newServiceId,
      providerId: validProviders.some((p) => p._id === prev.providerId)
        ? prev.providerId
        : (validProviders[0]?._id || ''),
    }));
  };

  const selectedService = services.find((s) => s._id === form.serviceId);
  const selectedProvider = providers.find((p) => p._id === form.providerId);

  // Filter providers matching selected service category
  const filteredProviders = selectedService
    ? providers.filter((p) => {
        const cats = [p.primaryCategory, ...(p.subCategories || []), ...(p.services || []).map((s) => s.category)];
        return cats.includes(selectedService.category);
      })
    : providers;

  const providerServiceItem = (selectedProvider?.services || []).find(
    (s) =>
      (s.category && selectedService?.category && s.category.toLowerCase() === selectedService.category.toLowerCase()) ||
      (s.name && selectedService?.name && s.name.toLowerCase() === selectedService.name.toLowerCase())
  ) || (selectedProvider?.services && selectedProvider.services[0]);

  const providerBasePrice =
    selectedProvider?.siteVisitFee ||
    selectedProvider?.consultationFee ||
    providerServiceItem?.basePrice ||
    selectedProvider?.startingPrice ||
    selectedProvider?.hourlyRate ||
    selectedService?.basePrice ||
    0;

  const availabilityStatus = useMemo(() => {
    if (!selectedProvider || !form.scheduledDate) return null;

    const avail = selectedProvider.availability;
    if (avail && avail.isAvailable === false) {
      return { ok: false, message: 'This provider is currently marked as unavailable for new bookings.' };
    }

    const [y, m, d] = form.scheduledDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    const localDate = new Date(y, m - 1, d);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[localDate.getDay()];
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 1. Check specific dates override
    const specific = avail?.specificDates?.find(sd => sd.date === dateStr);
    if (specific) {
      if (!specific.isAvailable) {
        return {
          ok: false,
          message: `Provider is unavailable on ${dateStr}${specific.reason ? ` (${specific.reason})` : ' (Holiday / Leave)'}.`,
        };
      }
      const sStart = specific.start || '09:00';
      const sEnd = specific.end || '18:00';
      if (form.timeStart && (form.timeStart < sStart || form.timeStart > sEnd)) {
        return {
          ok: false,
          message: `Selected start time (${form.timeStart}) is outside special hours for this date (${sStart} - ${sEnd}).`,
        };
      }
      return {
        ok: true,
        message: `Special working day on ${dateStr} (${sStart} - ${sEnd}).`,
      };
    }

    // 2. Check weekly schedule
    const scheduleItem = avail?.schedule?.find(s => s.day === dayOfWeek);
    let isWorking = false;
    let dayStart = '09:00';
    let dayEnd = '18:00';

    if (scheduleItem) {
      isWorking = Boolean(scheduleItem.enabled);
      dayStart = scheduleItem.start || '09:00';
      dayEnd = scheduleItem.end || '18:00';
    } else if (avail?.workingDays?.length) {
      isWorking = avail.workingDays.includes(dayOfWeek);
      dayStart = avail.workingHours?.start || '09:00';
      dayEnd = avail.workingHours?.end || '18:00';
    } else {
      isWorking = true;
    }

    if (!isWorking) {
      return {
        ok: false,
        message: `Provider does not work on ${dayOfWeek}s. Please choose a working day.`,
      };
    }

    if (form.timeStart && (form.timeStart < dayStart || form.timeStart > dayEnd)) {
      return {
        ok: false,
        message: `Selected time (${form.timeStart}) is outside provider's working hours on ${dayOfWeek} (${dayStart} - ${dayEnd}).`,
      };
    }

    return {
      ok: true,
      message: `Provider is available on ${dayOfWeek}s (${dayStart} - ${dayEnd}).`,
    };
  }, [selectedProvider, form.scheduledDate, form.timeStart]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    if (!form.providerId) {
      toast.error('Please select an active provider for this service.');
      return;
    }
    if (!form.serviceId) {
      toast.error('Please select a service.');
      return;
    }
    if (!form.scheduledDate) {
      toast.error('Please select a scheduled date.');
      return;
    }
    if (!form.street || !form.city || !form.state || !form.pincode) {
      toast.error('Please fill in complete address details.');
      return;
    }

    if (availabilityStatus && availabilityStatus.ok === false) {
      toast.error(availabilityStatus.message || 'Selected time is unavailable.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        providerId: form.providerId,
        serviceId: form.serviceId,
        scheduledDate: form.scheduledDate,
        scheduledTimeSlot: { start: form.timeStart, end: form.timeEnd },
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          coordinates: customerLocCoords
            ? { lat: customerLocCoords.latitude, lng: customerLocCoords.longitude }
            : undefined,
        },
        customerLocation: customerLocCoords || undefined,
        problemDescription: form.problemDescription || 'Site visit inspection request',
      };

      // 1. Generate Razorpay Checkout Order on backend (computes fee securely from DB)
      const orderRes = await API.post('/bookings/checkout-order', payload);
      const resData = orderRes.data?.data || {};
      const orderId = resData.orderId || resData.order_id;
      const keyId = resData.keyId || resData.key_id;
      const amount = resData.amount;
      const currency = resData.currency || 'INR';
      const isMock = Boolean(resData.isMock);
      const consultationFee = resData.consultationFee;

      if (!orderId || !keyId) {
        throw new Error('Invalid order response from payment gateway.');
      }

      // Helper to dynamically load Razorpay script
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

      if (!scriptLoaded) {
        toast.error('Razorpay SDK failed to load. Please check your internet connection or ad blocker.');
        setLoading(false);
        return;
      }

      if (isMock) {
        // Fallback only if backend explicitly reported mock mode
        const verifyRes = await API.post('/bookings/verify-and-create', {
          razorpayOrderId: orderId,
          razorpayPaymentId: 'pay_mock_' + Date.now(),
          razorpaySignature: 'mock_verified_sig',
          bookingData: payload,
        });
        toast.success(`Site Visit Fee of ₹${consultationFee} paid! Booking confirmed.`);
        navigate(`/bookings/${verifyRes.data.data._id}`);
        return;
      }

      // Live Razorpay Checkout
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: 'HomeEase Services',
        description: `Site Visit Fee — ${selectedService?.name || 'Service'}`,
        order_id: orderId,
        handler: async function (response) {
          setLoading(true);
          try {
            const verifyRes = await API.post('/bookings/verify-and-create', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              bookingData: payload,
            });
            toast.success(`Site Visit Fee of ₹${consultationFee} paid! Booking confirmed.`);
            navigate(`/bookings/${verifyRes.data.data._id}`);
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Payment verification failed');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            toast('Payment cancelled. Booking was not created.', { icon: 'ℹ️' });
          },
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#4f46e5',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setLoading(false);
        toast.error(`Payment failed: ${response.error?.description || 'Transaction declined'}. Booking was not created.`);
      });
      rzp.open();
    } catch (err) {
      console.error('Checkout error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to initiate booking payment';
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>New Booking</h1>
        <p style={{ color: 'var(--text-light)', marginBottom: 24 }}>Choose a service, schedule a time, review the site visit fee, and add your address.</p>

        <form className="card" style={{ padding: 24 }} onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Service</label>
              <select className="input" value={form.serviceId} onChange={(e) => handleServiceChange(e.target.value)} required>
                {services.map((service) => <option key={service._id} value={service._id}>{service.name} ({service.category})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Provider</label>
              <select className="input" value={form.providerId} onChange={(e) => update('providerId', e.target.value)} required>
                {filteredProviders.length === 0 ? (
                  <option value="">No verified providers available for this category</option>
                ) : (
                  filteredProviders.map((provider) => (
                    <option key={provider._id} value={provider._id}>
                      {provider.userId?.name || 'Provider'} — {provider.primaryCategory}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Date</label>
              <input className="input" type="date" value={form.scheduledDate} onChange={(e) => update('scheduledDate', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">Time</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="input" type="time" value={form.timeStart} onChange={(e) => update('timeStart', e.target.value)} required />
                <input className="input" type="time" value={form.timeEnd} onChange={(e) => update('timeEnd', e.target.value)} required />
              </div>
            </div>

            {availabilityStatus && (
              <div style={{
                gridColumn: '1 / -1',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: availabilityStatus.ok ? '#f0fdf4' : '#fef2f2',
                color: availabilityStatus.ok ? '#166534' : '#991b1b',
                border: `1px solid ${availabilityStatus.ok ? '#bbf7d0' : '#fecaca'}`,
                marginBottom: 10,
              }}>
                {availabilityStatus.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{availabilityStatus.message}</span>
              </div>
            )}
          </div>

          {/* Site Visit / Consultation Fee section */}
          <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>Site Visit / Consultation Fee</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>Payable upon booking for the in-person inspection</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--dark-accent)' }}>₹{providerBasePrice}</span>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, color: '#1e40af', lineHeight: 1.5 }}>
              <strong>Pricing Policy:</strong> If you award the project, this fee is deducted from the final project price. If you don't proceed, the fee is retained by the provider for the completed visit/consultation.
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="label" style={{ margin: 0 }}>Street Address</label>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ fontSize: 12, padding: '3px 8px', gap: 4 }}
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                        setCustomerLocCoords(coords);
                        toast.success(`Captured GPS Destination: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
                      },
                      (err) => {
                        toast.error(`Geolocation error: ${err.message}`);
                      },
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  } else {
                    toast.error('Geolocation not supported by browser');
                  }
                }}
              >
                <Navigation size={12} /> {customerLocCoords ? 'Update GPS Destination' : 'Capture Current GPS Destination'}
              </button>
            </div>
            <input className="input" value={form.street} onChange={(e) => update('street', e.target.value)} required />
            {customerLocCoords ? (
              <div style={{ fontSize: 12, color: '#15803d', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} color="#16a34a" />
                <span>GPS Destination linked: {customerLocCoords.latitude.toFixed(4)}, {customerLocCoords.longitude.toFixed(4)}</span>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} color="#d97706" />
                <span>Destination GPS not captured yet. Click above or allow browser location for automatic arrival tracking.</span>
              </div>
            )}
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">State</label>
              <input className="input" value={form.state} onChange={(e) => update('state', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">Pincode</label>
              <input className="input" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Problem Details</label>
            <textarea className="input" rows="4" value={form.problemDescription} onChange={(e) => update('problemDescription', e.target.value)} placeholder="Describe what you need help with" />
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || (availabilityStatus && availabilityStatus.ok === false)}
              style={{ width: '100%', justifyContent: 'center', gap: 10, fontSize: 15, padding: '14px 20px' }}
            >
              <CreditCard size={18} />
              {loading ? 'Processing Payment...' : `Pay ₹${providerBasePrice} Visit Fee & Confirm Booking`}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
              🔒 Compulsory pre-payment: Your ₹{providerBasePrice} fee is securely held and credited toward your project or settled after the inspection visit.
            </p>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default BookingCreate;
