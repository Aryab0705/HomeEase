import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Star, MapPin, Clock, Award, ChevronRight, ArrowLeft, Wrench } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { SkeletonCard, SkeletonProviderCard } from '../components/common/Skeleton';
import API from '../services/api';
import toast from 'react-hot-toast';

const StarRow = ({ rating }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1,2,3,4,5].map(n => (
      <Star key={n} size={14} fill={n <= Math.round(rating) ? '#f59e0b' : 'none'} color={n <= Math.round(rating) ? '#f59e0b' : '#d1d5db'} />
    ))}
  </div>
);

const ServiceDetail = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { isAuthenticated, user } = useSelector(s => s.auth);

  const [service,   setService]   = useState(null);
  const [providers, setProviders] = useState([]);
  const [svcLoad,   setSvcLoad]   = useState(true);
  const [prvLoad,   setPrvLoad]   = useState(true);
  const [error,     setError]     = useState(null);

  // Fetch service
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await API.get(`/services/${id}`);
        setService(data.data);
      } catch {
        setError('Service not found');
      } finally {
        setSvcLoad(false);
      }
    };
    fetch();
  }, [id]);

  // Fetch providers for this category once service is loaded
  useEffect(() => {
    if (!service?.category) return;
    const fetch = async () => {
      try {
        const { data } = await API.get('/providers', {
          params: { category: service.category, verified: true, limit: 12 },
        });
        setProviders(data.data?.providers ?? data.data ?? []);
      } catch {} finally {
        setPrvLoad(false);
      }
    };
    fetch();
  }, [service?.category]);

  const handleBook = (providerId) => {
    if (!isAuthenticated) {
      toast('Please login to book a service', { icon: '🔐' });
      navigate('/login', { state: { from: { pathname: `/services/${id}` } } });
      return;
    }
    if (user?.role !== 'customer') {
      toast.error('Only customers can book services');
      return;
    }
    navigate(`/bookings/new?serviceId=${id}&providerId=${providerId}`);
  };

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: 24 }}>
        <Wrench size={48} color="var(--text-light)" style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>{error}</h2>
        <Link to="/services" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeft size={15} /> Browse Services
        </Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        {/* Back */}
        <Link to="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-light)', fontSize: 14, textDecoration: 'none', marginBottom: 24, fontWeight: 500 }}>
          <ArrowLeft size={15} /> All Services
        </Link>

        {/* Service Hero */}
        {svcLoad ? (
          <SkeletonCard rows={4} />
        ) : service && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{ padding: 32, marginBottom: 32, background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
          >
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Icon */}
              <div style={{ width: 72, height: 72, borderRadius: 18, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', flexShrink: 0 }}>
                {service.icon || '🔧'}
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                {/* Category badge */}
                <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--dark-accent)', color: 'white', padding: '4px 12px', borderRadius: 20, display: 'inline-block', marginBottom: 10 }}>
                  {service.category}
                </span>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-dark)' }}>{service.name}</h1>
                <p style={{ color: 'var(--text-light)', fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>{service.description}</p>

                {/* Price chip */}
                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, background: 'white', borderRadius: 10, padding: '12px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', maxWidth: 450 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 600 }}>Site Visit / Consultation Fee:</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dark)' }}>₹{service.basePrice}</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#2563eb', lineHeight: 1.4 }}>
                    If you award the project, this fee is deducted from the final project price. If you don't proceed, the fee is retained by the provider for the completed visit/consultation.
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Providers Section */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Available Providers</h2>
          <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 20 }}>
            Verified professionals offering {service?.name || 'this service'} in your area
          </p>

          {prvLoad ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {[1,2,3].map(i => <SkeletonProviderCard key={i} />)}
            </div>
          ) : providers.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <Wrench size={40} color="var(--text-light)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Providers Available</h3>
              <p style={{ color: 'var(--text-light)', fontSize: 14 }}>
                There are no verified providers for this service yet. Check back soon!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {providers.map((provider, i) => (
                <motion.div
                  key={provider._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="card"
                  style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
                >
                  {/* Avatar */}
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'white', fontWeight: 700, flexShrink: 0 }}>
                    {provider.userId?.avatar?.url
                      ? <img src={provider.userId.avatar.url} alt={provider.userId.name} style={{ width: '100%', height: '100%', borderRadius: 14, objectFit: 'cover' }} />
                      : (provider.userId?.name?.[0] || 'P')}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{provider.userId?.name || 'Provider'}</span>
                      {provider.verificationStatus === 'verified' && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#d1fae5', color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Award size={10} /> Verified
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <StarRow rating={provider.rating?.average || 0} />
                        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
                          {provider.rating?.average?.toFixed(1) || '0.0'} ({provider.rating?.totalReviews || 0})
                        </span>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {provider.experience} yr exp
                      </span>
                      {provider.serviceArea?.city && (
                        <span style={{ fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {provider.serviceArea.city}
                        </span>
                      )}
                    </div>
                    {provider.bio && (
                      <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {provider.bio}
                      </p>
                    )}
                  </div>

                  {/* Price + Book */}
                  {(() => {
                    const providerSvc = provider.services?.find(
                      (s) => s.name?.toLowerCase() === service?.name?.toLowerCase() || s.category === service?.category
                    );
                    const displayPrice = providerSvc?.basePrice || provider.hourlyRate || service?.basePrice || 0;
                    return (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-dark)' }}>
                          ₹{displayPrice}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 8, fontWeight: 500 }}>
                          Site Visit Fee
                        </div>
                        <button
                          onClick={() => handleBook(provider._id)}
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          Book Visit <ChevronRight size={15} />
                        </button>
                      </div>
                    );
                  })()}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceDetail;
