import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Briefcase, CalendarPlus, MapPin, Star, MessageSquare } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import Avatar from '../components/common/Avatar';
import { PageSpinner } from '../components/common/Spinner';
import API from '../services/api';
import ProviderReviewsSection from '../components/reviews/ProviderReviewsSection';
import { CATEGORY_ICONS, formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const ProviderProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [matchingGlobalServices, setMatchingGlobalServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [providerRes, servicesRes] = await Promise.all([
          API.get(`/providers/${id}`),
          API.get('/services', { params: { limit: 100 } }),
        ]);
        const providerData = providerRes.data.data;
        const allGlobalServices = servicesRes.data.data?.services ?? [];

        setProvider(providerData);

        // Filter global services matching provider's primaryCategory or offered services
        const providerCategories = [
          providerData.primaryCategory,
          ...(providerData.subCategories || []),
          ...(providerData.services || []).map((s) => s.category),
        ].filter(Boolean);

        const relevantServices = allGlobalServices.filter((gs) =>
          providerCategories.includes(gs.category)
        );

        setMatchingGlobalServices(relevantServices);
        if (relevantServices.length > 0) {
          setSelectedServiceId(relevantServices[0]._id);
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load provider');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const user = provider?.userId;

  // Use provider's configured services as source of truth
  const providerServices = useMemo(() => {
    if (provider?.services?.length > 0) {
      return provider.services;
    }
    // Fallback display if provider has primaryCategory set but no custom items array
    if (provider?.primaryCategory) {
      return [
        {
          category: provider.primaryCategory,
          name: provider.primaryCategory,
          basePrice: provider.hourlyRate || provider.startingPrice || 499,
          priceUnit: 'per visit',
        },
      ];
    }
    return [];
  }, [provider]);

  const handleBook = () => {
    if (!selectedServiceId) {
      toast.error('Select a service first');
      return;
    }
    navigate(`/bookings/new?providerId=${id}&serviceId=${selectedServiceId}`);
  };

  if (loading) return <AppLayout><PageSpinner /></AppLayout>;

  if (!provider) {
    return (
      <AppLayout>
        <div className="card empty-state">
          <h2>Provider not found</h2>
          <Link to="/services" className="btn btn-primary">Back to Services</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link to="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-light)', fontSize: 14, textDecoration: 'none', marginBottom: 20, fontWeight: 600 }}>
        <ArrowLeft size={15} /> Back to Services
      </Link>

      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar src={user?.avatar?.url} name={user?.name} size="xl" />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 28 }}>{user?.name || 'Provider'}</h1>
              {provider.verificationStatus === 'verified' && <span className="badge badge-success"><Award size={13} /> Verified</span>}
              {provider.primaryCategory && <span className="badge badge-gray">{provider.primaryCategory}</span>}
            </div>
            <p style={{ color: 'var(--text-light)', maxWidth: 680 }}>{provider.bio || 'Professional home service provider.'}</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 18, color: 'var(--text-light)', fontSize: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Star size={15} /> {(provider.rating?.average || 0).toFixed(1)} rating
                {provider.rating?.totalReviews > 0 && (
                  <span>· {provider.rating.totalReviews} review{provider.rating.totalReviews === 1 ? '' : 's'}</span>
                )}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Briefcase size={15} /> {provider.experience || 0} years</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={15} /> {provider.serviceArea?.city || 'Service area available'}</span>
            </div>
          </div>
          <div style={{ minWidth: 260 }}>
            <label className="label">Available Services ({provider.primaryCategory || 'Services'})</label>
            {matchingGlobalServices.length > 0 ? (
              <select className="input" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} style={{ marginBottom: 12 }}>
                {matchingGlobalServices.map((gs) => {
                  // Find provider specific price for this service
                  const pSvc = provider.services?.find(
                    (s) => s.name?.toLowerCase() === gs.name?.toLowerCase() || s.category === gs.category
                  );
                  const price = pSvc?.basePrice || provider.hourlyRate || gs.basePrice || 0;
                  return (
                    <option key={gs._id} value={gs._id}>
                      {gs.name} — ₹{price}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>
                Category: {provider.primaryCategory || 'General'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary btn-lg" onClick={handleBook} style={{ width: '100%', gap: 8 }}>
                <CalendarPlus size={17} /> Book Service
              </button>
              {user?._id && (
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', gap: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={async () => {
                    try {
                      const res = await API.post('/chats/initiate', { recipientUserId: user._id });
                      navigate(`/chat/${res.data.data._id}`);
                    } catch (e) {
                      toast.error(e?.response?.data?.message || 'Could not start chat');
                    }
                  }}
                >
                  <MessageSquare size={16} /> Chat with Provider
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Offered Services ({provider.primaryCategory})</h2>
      <div className="grid-3">
        {providerServices.map((service, idx) => (
          <div key={service._id || service.name || idx} className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{CATEGORY_ICONS[service.category] || '🔧'}</div>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>{service.name}</h3>
            <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 10 }}>{service.category}</p>
            <strong style={{ fontSize: 18, color: 'var(--text-dark)' }}>{formatCurrency(service.basePrice || provider.hourlyRate || 0)}</strong>
          </div>
        ))}
      </div>

      {/* Public reputation — visible to every visitor, signed in or not. */}
      <ProviderReviewsSection providerId={provider._id || id} />
    </AppLayout>
  );
};

export default ProviderProfile;
