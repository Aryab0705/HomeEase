import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Layers, Plus, Edit2, CheckCircle, XCircle, Power, Tag } from 'lucide-react';
import API from '../../services/api';
import { SERVICE_CATEGORIES } from '../../utils/helpers';
import { PageSpinner } from '../../components/common/Spinner';

const AdminServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({
    name: '',
    category: SERVICE_CATEGORIES[0] || 'Plumbing',
    description: '',
    basePrice: 500,
    priceUnit: 'consultation_fee',
    tags: '',
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await API.get('/services');
      setServices(res.data.data?.services || res.data.data || []);
    } catch (err) {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenCreate = () => {
    setEditingService(null);
    setForm({
      name: '',
      category: SERVICE_CATEGORIES[0] || 'Plumbing',
      description: '',
      basePrice: 500,
      priceUnit: 'consultation_fee',
      tags: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingService(s);
    setForm({
      name: s.name,
      category: s.category,
      description: s.description || '',
      basePrice: s.basePrice || 0,
      priceUnit: s.priceUnit || 'consultation_fee',
      tags: (s.tags || []).join(', '),
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        basePrice: Number(form.basePrice),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      if (editingService) {
        await API.put(`/admin/services/${editingService._id}`, payload);
        toast.success('Service updated successfully');
      } else {
        await API.post('/admin/services', payload);
        toast.success('Service created successfully');
      }
      setShowModal(false);
      fetchServices();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save service');
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await API.patch(`/admin/services/${id}/toggle`);
      toast.success('Service status updated');
      fetchServices();
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  const filteredServices = activeCategory === 'All'
    ? services
    : services.filter(s => s.category === activeCategory);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Services & Categories</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Manage platform categories, offered services, prices, and status</p>
        </div>
        <button onClick={handleOpenCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add New Service
        </button>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '24px', paddingBottom: '8px' }}>
        {['All', ...SERVICE_CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeCategory === cat ? '#3b82f6' : 'white', color: activeCategory === cat ? 'white' : '#64748b',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s', whiteSpace: 'nowrap'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services List */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><PageSpinner /></div>
        ) : filteredServices.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <Layers size={40} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
            <div style={{ fontWeight: 600 }}>No services found in this category</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Service Name</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Base Price</th>
                  <th style={{ padding: '12px 16px' }}>Unit</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map(s => (
                  <tr key={s._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1e293b' }}>
                      {s.name}
                      {s.description && <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>{s.description}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                        {s.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b' }}>
                      ₹{s.basePrice}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>
                      {s.priceUnit}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                        background: s.isActive ? '#dcfce7' : '#fee2e2', color: s.isActive ? '#15803d' : '#991b1b'
                      }}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenEdit(s)} className="btn btn-outline btn-sm" style={{ padding: '6px 10px' }}>
                          <Edit2 size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(s._id)}
                          className="btn btn-outline btn-sm"
                          style={{
                            padding: '6px 10px',
                            borderColor: s.isActive ? '#ef4444' : '#22c55e',
                            color: s.isActive ? '#ef4444' : '#22c55e'
                          }}
                        >
                          <Power size={14} /> {s.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>
              {editingService ? 'Edit Service' : 'Add New Service'}
            </h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="label">Service Name</label>
                <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Site Visit / Consultation Fee (₹)</label>
                  <input type="number" required min="0" className="input" value={form.basePrice} onChange={e => setForm({ ...form, basePrice: e.target.value })} />
                </div>
                <div>
                  <label className="label">Price Unit</label>
                  <select className="input" value={form.priceUnit} onChange={e => setForm({ ...form, priceUnit: e.target.value })}>
                    <option value="consultation_fee">consultation fee</option>
                    <option value="per visit">per visit</option>
                  </select>
                </div>
              </div>
              <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', color: '#1e40af' }}>
                Policy: If customer awards the project, this fee is credited toward the project quotation. If rejected, it is retained for the completed visit.
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" style={{ height: '80px' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Tags (comma separated)</label>
                <input className="input" placeholder="plumbing, leak, repair" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingService ? 'Update Service' : 'Create Service'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminServices;
