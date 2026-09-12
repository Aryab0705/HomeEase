import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, Save, ShieldCheck, UserRound } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { updateUser } from '../../redux/authSlice';
import { PageHeader, PanelCard } from './ProviderPanelComponents';
import { SERVICE_CATEGORIES, getProviderUser, profileCompletion } from './providerPanelUtils';

const splitList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const joinList = value => (Array.isArray(value) ? value.join(', ') : '');

const initialForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  bio: '',
  experience: 0,
  serviceRadius: 20,
  city: '',
  state: '',
  primaryCategory: '',
  subCategories: '',
  skills: '',
  languages: '',
  hourlyRate: 0,
  startingPrice: 0,
  emergencyService: false,
};

const ProviderProfile = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const user = useMemo(() => getProviderUser(provider), [provider]);
  const completion = useMemo(() => profileCompletion(provider), [provider]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await API.get('/providers/profile');
        const nextProvider = data.data;
        const nextUser = getProviderUser(nextProvider);
        setProvider(nextProvider);
        setForm({
          name: nextUser.name || '',
          email: nextUser.email || '',
          phone: nextUser.phone || '',
          address: nextUser.address || '',
          bio: nextProvider.bio || '',
          experience: nextProvider.experience || 0,
          serviceRadius: nextProvider.serviceArea?.radius || 20,
          city: nextProvider.serviceArea?.city || '',
          state: nextProvider.serviceArea?.state || '',
          primaryCategory: nextProvider.primaryCategory || nextProvider.services?.[0]?.category || '',
          subCategories: joinList(nextProvider.subCategories?.length ? nextProvider.subCategories : [...new Set((nextProvider.services || []).map(s => s.category))]),
          skills: joinList(nextProvider.skills?.length ? nextProvider.skills : (nextProvider.services || []).map(s => s.name)),
          languages: joinList(nextProvider.languages || []),
          hourlyRate: nextProvider.hourlyRate || nextProvider.services?.find(s => s.priceUnit === 'per hour')?.basePrice || 0,
          startingPrice: nextProvider.startingPrice || Math.min(...(nextProvider.services?.length ? nextProvider.services : [{ basePrice: 0 }]).map(s => s.basePrice || 0)),
          emergencyService: Boolean(nextProvider.emergencyService),
        });
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load provider profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const syncUser = nextUser => {
    dispatch(updateUser(nextUser));
    queryClient.setQueryData(['auth-user'], old => ({ ...(old || {}), ...nextUser }));
    queryClient.invalidateQueries({ queryKey: ['provider-profile'] });
    queryClient.invalidateQueries({ queryKey: ['auth-user'] });
  };

  const handleAvatar = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    const body = new FormData();
    body.append('image', file);
    setUploadingAvatar(true);
    try {
      const { data } = await API.put('/users/avatar', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const avatar = data.data?.avatar;
      const nextUser = { ...user, avatar };
      const nextProvider = { ...provider, userId: nextUser };
      setProvider(nextProvider);
      syncUser({ avatar });
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Avatar upload failed');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleSave = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const userPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      };

      const providerPayload = {
        bio: form.bio.trim(),
        experience: Number(form.experience || 0),
        serviceArea: {
          city: form.city.trim(),
          state: form.state.trim(),
          radius: Number(form.serviceRadius || 0),
        },
        primaryCategory: form.primaryCategory || undefined,
        subCategories: splitList(form.subCategories),
        skills: splitList(form.skills),
        languages: splitList(form.languages),
        hourlyRate: Number(form.hourlyRate || 0),
        startingPrice: Number(form.startingPrice || 0),
        emergencyService: Boolean(form.emergencyService),
      };

      const [userRes, providerRes] = await Promise.all([
        API.put('/users/profile', userPayload),
        API.put('/providers/profile', providerPayload),
      ]);

      const nextUser = userRes.data.data;
      const nextProvider = { ...providerRes.data.data, userId: nextUser };
      setProvider(nextProvider);
      syncUser(nextUser);
      queryClient.setQueryData(['provider-profile'], nextProvider);
      toast.success('Provider profile saved');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppLayout><PageSpinner /></AppLayout>;

  return (
    <AppLayout>
      <form className="provider-workspace" onSubmit={handleSave}>
        <PageHeader
          eyebrow="Identity"
          title="Provider Profile"
          description="One source of truth for your public profile, professional details, categories, rates, skills, languages, and service area."
          actions={<button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}</button>}
        />

        <div className="provider-verification-strip">
          <span className={`provider-badge ${provider?.verificationStatus === 'verified' ? 'success' : 'warning'}`}><ShieldCheck size={16} /> {provider?.verificationStatus || 'pending'}</span>
          <span className="provider-badge">{completion}% profile complete</span>
        </div>

        <div className="provider-grid provider-grid-2">
          <PanelCard title="Public Profile" subtitle="Visible to customers and used across the provider portal.">
            <div className="provider-profile-card">
              <label className="provider-profile-photo is-editable">
                {user.avatar?.url ? <img src={user.avatar.url} alt={user.name} /> : <UserRound size={34} />}
                <input type="file" accept="image/*" hidden onChange={handleAvatar} disabled={uploadingAvatar} />
                <span><Camera size={14} /> {uploadingAvatar ? 'Uploading' : 'Change'}</span>
              </label>
              <div>
                <h3>{user.name || 'Provider name'}</h3>
                <p>{user.email || 'email@example.com'}</p>
                <p>{user.phone || 'Phone not added'}</p>
              </div>
            </div>

            <div className="provider-form-grid">
              <label><span className="label">Full Name</span><input className="input" value={form.name} onChange={e => setField('name', e.target.value)} required /></label>
              <label><span className="label">Phone</span><input className="input" value={form.phone} onChange={e => setField('phone', e.target.value)} required /></label>
              <label><span className="label">Email</span><input className="input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} required /></label>
              <label><span className="label">Service Radius (km)</span><input className="input" type="number" min="0" value={form.serviceRadius} onChange={e => setField('serviceRadius', e.target.value)} /></label>
              <label className="wide"><span className="label">Address</span><input className="input" value={form.address} onChange={e => setField('address', e.target.value)} /></label>
              <label><span className="label">City</span><input className="input" value={form.city} onChange={e => setField('city', e.target.value)} /></label>
              <label><span className="label">State</span><input className="input" value={form.state} onChange={e => setField('state', e.target.value)} /></label>
              <label className="wide"><span className="label">About Me</span><textarea className="input provider-textarea" value={form.bio} onChange={e => setField('bio', e.target.value)} /></label>
            </div>
          </PanelCard>

          <PanelCard title="Professional Details" subtitle="Used for ranking, filters, and customer confidence.">
            <div className="provider-form-grid">
              <label>
                <span className="label">Primary Category</span>
                <select className="input" value={form.primaryCategory} onChange={e => setField('primaryCategory', e.target.value)}>
                  <option value="">Select category</option>
                  {SERVICE_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label><span className="label">Sub Categories</span><input className="input" value={form.subCategories} onChange={e => setField('subCategories', e.target.value)} placeholder="Plumbing, Cleaning" /></label>
              <label className="wide"><span className="label">Skills</span><input className="input" value={form.skills} onChange={e => setField('skills', e.target.value)} placeholder="Leak repair, Deep cleaning" /></label>
              <label><span className="label">Site Visit Fee (₹)</span><input className="input" type="number" min="0" value={form.hourlyRate} onChange={e => setField('hourlyRate', e.target.value)} /></label>
              <label><span className="label">Starting Price</span><input className="input" type="number" min="0" value={form.startingPrice} onChange={e => setField('startingPrice', e.target.value)} /></label>
              <label><span className="label">Experience (years)</span><input className="input" type="number" min="0" value={form.experience} onChange={e => setField('experience', e.target.value)} /></label>
              <label><span className="label">Languages</span><input className="input" value={form.languages} onChange={e => setField('languages', e.target.value)} placeholder="English, Hindi" /></label>
              <label className="provider-toggle-row wide">
                <span>Emergency Service</span>
                <input type="checkbox" checked={form.emergencyService} onChange={e => setField('emergencyService', e.target.checked)} />
              </label>
            </div>
          </PanelCard>
        </div>
      </form>
    </AppLayout>
  );
};

export default ProviderProfile;
