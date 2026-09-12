import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

const Unauthorized = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
    <div style={{ textAlign: 'center', padding: 32 }}>
      <ShieldOff size={64} color="var(--error)" style={{ margin: '0 auto 20px' }} />
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Access Denied</h1>
      <p style={{ color: 'var(--text-light)', marginBottom: 24 }}>You don't have permission to view this page.</p>
      <Link to="/" className="btn btn-primary">Go Home</Link>
    </div>
  </div>
);

export default Unauthorized;
