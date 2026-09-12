import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, Shield, Clock, ArrowRight, Phone, Mail } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { CATEGORY_ICONS, SERVICE_CATEGORIES } from '../utils/helpers';

const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

const TESTIMONIALS = [
  { name: 'Priya Sharma',  role: 'Homeowner, Mumbai',  text: 'Found a great plumber within minutes! Service was professional and affordable.',  rating: 5, avatar: 'PS' },
  { name: 'Rahul Verma',   role: 'Homeowner, Delhi',   text: 'The electrician came on time and fixed everything perfectly. Highly recommend!',   rating: 5, avatar: 'RV' },
  { name: 'Anita Singh',   role: 'Homeowner, Bangalore',text: 'AC repair was done in under an hour. Very happy with the HomeEase platform.',    rating: 5, avatar: 'AS' },
];

const HOW_IT_WORKS = [
  { step: 1, icon: '🔍', title: 'Search a Service',    desc: 'Browse categories or search for the service you need.' },
  { step: 2, icon: '📋', title: 'Choose a Provider',   desc: 'Compare ratings, prices, and book your preferred expert.' },
  { step: 3, icon: '✅', title: 'Get it Done',          desc: 'Provider arrives at your location and completes the job.' },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="page-wrapper">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero-bg" style={{ padding: '80px 0 100px' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fadeUp} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'white', padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600, marginBottom: 20, boxShadow: '0 2px 8px rgba(171,196,255,0.3)' }}>
              <Shield size={14} color="#5a85ff" /> Trusted by 50,000+ Homeowners
            </motion.div>
            <motion.h1 variants={fadeUp} style={{ fontSize: 52, lineHeight: 1.1, marginBottom: 20, color: 'var(--text-dark)' }}>
              Home Services,<br />
              <span className="gradient-text">Redefined.</span>
            </motion.h1>
            <motion.p variants={fadeUp} style={{ fontSize: 18, color: 'var(--text-light)', marginBottom: 36, maxWidth: 480, lineHeight: 1.7 }}>
              Connect with verified, rated, and background-checked professionals for any home service — fast, affordable, and hassle-free.
            </motion.p>
            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 14 }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/services')} style={{ gap: 10 }}>
                Book a Service <ArrowRight size={18} />
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => navigate('/register?role=provider')}>
                Become a Provider
              </button>
            </motion.div>
            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 28, marginTop: 40 }}>
              {[{ label: '50K+', sub: 'Happy Customers' }, { label: '5K+', sub: 'Verified Providers' }, { label: '4.8★', sub: 'Average Rating' }].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dark)' }}>{s.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {SERVICE_CATEGORIES.slice(0, 6).map((cat, i) => (
              <motion.div key={cat} className="card card-clickable" style={{ padding: '20px 16px', textAlign: 'center', cursor: 'pointer' }}
                onClick={() => navigate(`/services?category=${encodeURIComponent(cat)}`)}
                whileHover={{ scale: 1.04 }} transition={{ delay: i * 0.07 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{CATEGORY_ICONS[cat]}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>{cat}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <motion.div style={{ textAlign: 'center', marginBottom: 56 }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 36, marginBottom: 12 }}>How HomeEase Works</h2>
            <p style={{ color: 'var(--text-light)', fontSize: 16 }}>Get your home service done in 3 simple steps</p>
          </motion.div>
          <div className="grid-3">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={step.step} className="card" style={{ padding: 32, textAlign: 'center' }}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} viewport={{ once: true }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>{step.icon}</div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--dark-accent)', color: 'var(--text-dark)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{step.step}</div>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ color: 'var(--text-light)', fontSize: 14 }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services Grid ───────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--primary)' }}>
        <div className="container">
          <motion.div style={{ textAlign: 'center', marginBottom: 48 }} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 36, marginBottom: 12 }}>All Home Services</h2>
            <p style={{ color: 'var(--text-light)', fontSize: 16 }}>From plumbing to painting — we've got you covered</p>
          </motion.div>
          <div className="grid-4">
            {SERVICE_CATEGORIES.map((cat, i) => (
              <motion.div key={cat} className="card card-clickable" style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
                onClick={() => navigate(`/services?category=${encodeURIComponent(cat)}`)}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} viewport={{ once: true }}
                whileHover={{ scale: 1.03 }}>
                <div style={{ fontSize: 28, width: 48, height: 48, background: 'var(--primary)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {CATEGORY_ICONS[cat]}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{cat}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>Book Now →</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Badges ────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="grid-3">
            {[
              { icon: <Shield size={28} color="#5a85ff" />, title: 'Verified Professionals', desc: 'Background-checked and document-verified service providers.' },
              { icon: <Star size={28} color="#fbbf24" />, title: 'Rating & Reviews', desc: 'Real reviews from genuine customers. Choose with confidence.' },
              { icon: <Clock size={28} color="#22c55e" />, title: 'On-Time Service', desc: 'Track your provider in real-time. Always on schedule.' },
            ].map((b, i) => (
              <motion.div key={b.title} className="card" style={{ padding: 32, textAlign: 'center' }}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} viewport={{ once: true }}>
                <div style={{ marginBottom: 16 }}>{b.icon}</div>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{b.title}</h3>
                <p style={{ color: 'var(--text-light)', fontSize: 14 }}>{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--secondary)' }}>
        <div className="container">
          <motion.div style={{ textAlign: 'center', marginBottom: 48 }} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 36, marginBottom: 8 }}>What Our Customers Say</h2>
          </motion.div>
          <div className="grid-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} className="card" style={{ padding: 28 }}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} viewport={{ once: true }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {Array.from({ length: t.rating }, (_, j) => <span key={j} style={{ color: '#fbbf24' }}>★</span>)}
                </div>
                <p style={{ color: 'var(--text-dark)', fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar avatar-md" style={{ background: 'var(--dark-accent)', fontSize: 12, fontWeight: 700 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'linear-gradient(135deg, var(--dark-accent) 0%, #7fa8ff 100%)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 40, color: 'var(--text-dark)', marginBottom: 16 }}>Ready to Get Started?</h2>
            <p style={{ fontSize: 18, color: 'var(--text-dark)', opacity: 0.75, marginBottom: 36 }}>Join thousands of satisfied homeowners today.</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-lg" onClick={() => navigate('/register')} style={{ background: 'white', color: 'var(--text-dark)', fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                Create Free Account
              </button>
              <button className="btn btn-lg btn-outline" onClick={() => navigate('/services')} style={{ border: '2px solid rgba(30,41,59,0.3)', color: 'var(--text-dark)' }}>
                Browse Services
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--text-dark)', color: 'white', padding: '48px 0 24px' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--dark-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏠</div>
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18 }}>HomeEase</span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7 }}>India's most trusted home service marketplace. Connecting homeowners with verified professionals.</p>
            </div>
            {[
              { title: 'Services', links: ['Plumbing', 'Electrician', 'Painting', 'AC Repair'] },
              { title: 'Company',  links: ['About Us', 'Careers', 'Blog', 'Press'] },
              { title: 'Support',  links: ['Help Center', 'Contact Us', 'Privacy Policy', 'Terms'] },
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'white' }}>{col.title}</h4>
                {col.links.map(l => (
                  <div key={l} style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8, cursor: 'pointer' }}>{l}</div>
                ))}
              </div>
            ))}
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #334155', marginBottom: 24 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ color: '#64748b', fontSize: 13 }}>© {new Date().getFullYear()} HomeEase. All rights reserved.</p>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13 }}><Phone size={14} /> +91 98765 43210</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13 }}><Mail size={14} /> hello@homeease.in</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
