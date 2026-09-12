import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Check, Wrench, Edit2 } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';
import API from '../../services/api';

const CATEGORIES = [
  'Plumbing','Electrician','Painting','Carpenter',
  'AC Repair','Cleaning','Renovation','Appliance Repair',
  'Pest Control','Interior Design',
];
const EMPTY_FORM = { category: '', name: '', description: '', basePrice: '', priceUnit: 'consultation_fee' };

const ManageServices = () => {
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [myServices, setMyServices] = useState([]);
  const [providerProfile, setProviderProfile] = useState(null);
  const [providerLoading, setProviderLoading] = useState(true);

  const fetchServices = async () => {
    try {
      const { data } = await API.get('/providers/me/profile');
      setProviderProfile(data.data);
      setMyServices(data.data?.services || []);
      return data.data;
    } catch {
      toast.error('Failed to load your services');
      return null;
    }
  };

  useEffect(() => {
    fetchServices().then((profile) => {
      if (profile?.primaryCategory) {
        setForm(prev => ({ ...prev, category: profile.primaryCategory }));
      }
    }).finally(() => setProviderLoading(false));
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
    }
  }, [searchParams]);

  const handleAddNew = () => {
    setDeleteId(null);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      category: providerProfile?.primaryCategory || '',
    });
    setShowForm(true);
  };

  const handleEdit = (svc) => {
    setDeleteId(null);
    setEditingId(svc._id);
    setForm({
      category: svc.category || providerProfile?.primaryCategory || '',
      name: svc.name || '',
      description: svc.description || '',
      basePrice: svc.basePrice !== undefined && svc.basePrice !== null ? String(svc.basePrice) : '',
      priceUnit: svc.priceUnit || 'consultation_fee',
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      category: providerProfile?.primaryCategory || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.name || form.basePrice === '' || form.basePrice === undefined) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await API.put('/providers/me/services', {
          action: 'edit',
          serviceId: editingId,
          service: { ...form, basePrice: Number(form.basePrice) },
        });
        toast.success('Service updated successfully!');
      } else {
        await API.put('/providers/me/services', {
          action: 'add',
          service: { ...form, basePrice: Number(form.basePrice) },
        });
        toast.success('Service added successfully!');
      }
      handleCancelForm();
      // Immediately refresh provider profile and services without page reload
      await fetchServices();
    } catch (err) {
      toast.error(err?.response?.data?.message || (editingId ? 'Failed to update service' : 'Failed to add service'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (svcId) => {
    try {
      await API.put('/providers/me/services', { action: 'remove', serviceId: svcId });
      setMyServices(prev => prev.filter(s => s._id !== svcId));
      if (editingId === svcId) {
        handleCancelForm();
      }
      toast.success('Service removed');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove service');
    } finally {
      setDeleteId(null);
    }
  };

  const categoryColors = {
    'Plumbing': '#3b82f6', 'Electrician': '#f59e0b', 'Painting': '#8b5cf6',
    'Carpenter': '#92400e', 'AC Repair': '#06b6d4', 'Cleaning': '#10b981',
    'Renovation': '#f97316', 'Appliance Repair': '#ef4444',
    'Pest Control': '#84cc16', 'Interior Design': '#ec4899',
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 900 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>My Services</h1>
              <p style={{ color: 'var(--text-light)', fontSize: 14 }}>
                Manage the services you offer to customers
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAddNew}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={16} /> Add Service
            </button>
          </div>

          {/* Add/Edit Service Form Modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card"
                style={{ padding: 24, marginBottom: 24, border: '2px solid var(--accent)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{editingId ? 'Edit Service' : 'Add New Service'}</h3>
                  <button type="button" onClick={handleCancelForm}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="label">Category *</label>
                      <select
                        className="input"
                        value={form.category}
                        onChange={e => setForm({ ...form, category: e.target.value })}
                        required
                        disabled={Boolean(providerProfile?.primaryCategory)}
                      >
                        {providerProfile?.primaryCategory ? (
                          <option value={providerProfile.primaryCategory}>{providerProfile.primaryCategory}</option>
                        ) : (
                          <>
                            <option value="">Select category</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </>
                        )}
                      </select>
                      {providerProfile?.primaryCategory && (
                        <span style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2, display: 'block' }}>
                          Locked to your primary category ({providerProfile.primaryCategory})
                        </span>
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="label">Service Name *</label>
                      <input className="input" placeholder="e.g. Pipe Leak Repair" value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="label">Site Visit / Consultation Fee (₹) *</label>
                      <input className="input" type="number" min="0" placeholder="e.g. 500" value={form.basePrice}
                        onChange={e => setForm({ ...form, basePrice: e.target.value })} required />
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af', lineHeight: 1.5, marginBottom: 16 }}>
                    <strong>Pricing Policy:</strong> If you award the project, this fee is deducted from the final project price. If you don't proceed, the fee is retained by the provider for the completed visit/consultation.
                  </div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="label">Description</label>
                    <textarea className="input" rows={2} placeholder="Brief description of what you offer..." value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      style={{ resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-outline" onClick={handleCancelForm}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={15} />{saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Service')}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* My Services List */}
          {providerLoading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[1,2,3].map(i => (
                <div key={i} className="card" style={{ padding: 20, height: 80, background: 'var(--primary)', borderRadius: 12 }} />
              ))}
            </div>
          ) : myServices.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <Wrench size={40} color="var(--text-light)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Services Added</h3>
              <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 20 }}>
                Add services you offer to start receiving booking requests
              </p>
              <button className="btn btn-primary" onClick={handleAddNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Plus size={15} /> Add Your First Service
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {myServices.map((svc, i) => (
                <motion.div
                  key={svc._id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card"
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}
                >
                  {/* Category color dot */}
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${categoryColors[svc.category] || '#6366f1'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Wrench size={20} color={categoryColors[svc.category] || '#6366f1'} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)' }}>{svc.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${categoryColors[svc.category] || '#6366f1'}18`, color: categoryColors[svc.category] || '#6366f1' }}>
                        {svc.category}
                      </span>
                    </div>
                    {svc.description && <p style={{ fontSize: 13, color: 'var(--text-light)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.description}</p>}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>₹{svc.basePrice}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 500 }}>Site Visit Fee</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {deleteId === svc._id ? (
                      <>
                        <button className="btn btn-sm" style={{ background: 'var(--error)', color: 'white', border: 'none' }} onClick={() => handleDelete(svc._id)}>Confirm</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setDeleteId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(svc)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: editingId === svc._id ? 'var(--accent)' : 'var(--text-light)',
                            padding: 6,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Edit service"
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                          onMouseLeave={e => e.currentTarget.style.color = editingId === svc._id ? 'var(--accent)' : 'var(--text-light)'}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteId(svc._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-light)',
                            padding: 6,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Remove service"
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
      </div>
    </AppLayout>
  );
};

export default ManageServices;
