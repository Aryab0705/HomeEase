import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Search, FileText, CheckCircle, XCircle, AlertCircle,
  Eye, RefreshCw, AlertTriangle, Check, User, Briefcase, Award, Wrench
} from 'lucide-react';
import API from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';

const AdminVerification = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('under_review');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerDetail, setProviderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [categoryNotes, setCategoryNotes] = useState({});
  const isFetchingRef = useRef(false);

  const fetchVerifications = async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const res = await API.get('/admin/verification/requests', {
        params: { status: statusFilter }
      });
      setProviders(res.data.data?.providers || []);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to load verification requests';
      toast.error(errMsg, { id: 'admin-verification-error' });
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [statusFilter]);

  const openProviderReview = async (provider) => {
    setSelectedProvider(provider);
    setCategoryNotes({});
    try {
      setDetailLoading(true);
      const res = await API.get(`/admin/providers/${provider._id}/verification`);
      if (res.data?.data?.provider) {
        setProviderDetail(res.data.data.provider);
      } else {
        setProviderDetail(provider);
      }
    } catch (err) {
      setProviderDetail(provider);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCategoryAction = async (category, action) => {
    if (!selectedProvider) return;
    try {
      setActionLoading(true);
      const notes = categoryNotes[category] || '';
      await API.patch(`/admin/providers/${selectedProvider._id}/verify-category`, {
        category,
        action,
        notes
      });
      toast.success(`${category.toUpperCase()} marked as ${action}!`);
      // Refresh details
      const res = await API.get(`/admin/providers/${selectedProvider._id}/verification`);
      if (res.data?.data?.provider) {
        setProviderDetail(res.data.data.provider);
      }
      fetchVerifications();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to update ${category}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverallVerify = async (status, targetProvider = selectedProvider) => {
    if (!targetProvider) return;
    try {
      setActionLoading(true);
      await API.patch(`/admin/providers/${targetProvider._id}/verify`, {
        status,
        reason: status === 'rejected' ? rejectionReason : undefined
      });
      toast.success(`Provider overall status set to ${status}!`);
      setSelectedProvider(null);
      setProviderDetail(null);
      setRejectionReason('');
      fetchVerifications();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${status} provider`);
    } finally {
      setActionLoading(false);
    }
  };

  const getPillarBadge = (status) => {
    switch (status) {
      case 'verified':
        return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>✓ Verified</span>;
      case 'submitted':
        return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8' }}>⏳ Submitted</span>;
      case 'mismatch':
        return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>⚠ Mismatch</span>;
      case 'rejected':
        return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>✕ Rejected</span>;
      case 'not_required':
        return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>Optional</span>;
      default:
        return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>Pending</span>;
    }
  };

  const currentProvider = providerDetail || selectedProvider;
  const v = currentProvider?.verification || {};
  const isLicensed = currentProvider?.primaryCategory === 'Electrician';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Provider Verification Center</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Review identity, practical experience, skills, and trade credentials. Certificates optional for non-licensed trades.</p>
        </div>
        <button onClick={fetchVerifications} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['under_review', 'pending', 'verified', 'rejected', 'all'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid',
              borderColor: statusFilter === st ? '#3b82f6' : '#e2e8f0',
              background: statusFilter === st ? '#3b82f6' : 'white',
              color: statusFilter === st ? 'white' : '#64748b',
              cursor: 'pointer', textTransform: 'capitalize'
            }}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Grid of Providers */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><PageSpinner /></div>
        ) : providers.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <ShieldCheck size={40} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
            <div style={{ fontWeight: 600 }}>No verification requests found</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', padding: '20px' }}>
            {providers.map(p => {
              const name = p.userId?.name || 'Provider';
              const email = p.userId?.email || 'email@example.com';
              const pv = p.verification || {};
              const idSt = pv.identity?.status || (p.documents?.length ? 'submitted' : 'not_submitted');
              const expSt = pv.experience?.status || (p.experience > 0 ? 'submitted' : 'not_submitted');
              const skillSt = pv.skills?.status || (p.skills?.length ? 'submitted' : 'not_submitted');
              const qualSt = pv.qualification?.status || (p.primaryCategory === 'Electrician' ? 'not_submitted' : 'not_required');
              const overall = pv.overallStatus || p.verificationStatus || 'pending';

              return (
                <div key={p._id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#e0e7ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px' }}>
                      {name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{email} · <strong style={{ color: '#0f172a' }}>{p.primaryCategory || 'General'}</strong></div>
                    </div>
                  </div>

                  {/* 4-Pillar Status Grid */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Identity:</div>
                      {getPillarBadge(idSt)}
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Experience:</div>
                      {getPillarBadge(expSt)}
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Skills:</div>
                      {getPillarBadge(skillSt)}
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: 2 }}>Qualification:</div>
                      {getPillarBadge(qualSt)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>Overall Status:</span>
                    <span style={{
                      textTransform: 'capitalize', fontWeight: 700,
                      color: overall === 'verified' ? '#15803d' : overall === 'rejected' ? '#991b1b' : '#92400e'
                    }}>
                      {overall.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    <button onClick={() => openProviderReview(p)} className="btn btn-outline btn-sm" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                      <Eye size={14} /> Review Application
                    </button>
                    {overall !== 'verified' ? (
                      <button onClick={() => handleOverallVerify('verified', p)} className="btn btn-primary btn-sm" style={{ flex: 1, background: '#22c55e', borderColor: '#22c55e' }}>
                        Quick Approve
                      </button>
                    ) : (
                      <button onClick={() => handleOverallVerify('rejected', p)} className="btn btn-outline btn-sm" style={{ flex: 1, color: '#ef4444', borderColor: '#ef4444' }}>
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comprehensive Review Modal */}
      {selectedProvider && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '850px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Verification Dossier: {currentProvider?.userId?.name || 'Provider'}
                </h2>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
                  Primary Trade: <strong>{currentProvider?.primaryCategory}</strong> · Email: {currentProvider?.userId?.email} · Phone: {currentProvider?.userId?.phone || 'N/A'}
                </p>
              </div>
              <button onClick={() => setSelectedProvider(null)} className="btn btn-outline btn-sm">✕ Close</button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><PageSpinner /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Identity Review */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                      <User size={18} color="#3b82f6" /> 1. Identity Verification
                    </div>
                    <div>{getPillarBadge(v.identity?.status || 'not_submitted')}</div>
                  </div>

                  {/* Uploaded ID Documents with Previews */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                      Submitted Identity Documents ({v.identity?.documents?.length || 0}):
                    </div>
                    {(!v.identity?.documents || v.identity.documents.length === 0) ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', background: 'white', padding: 10, borderRadius: 6, border: '1px dashed #cbd5e1' }}>
                        No identity files uploaded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                        {v.identity.documents.map((doc, i) => {
                          const isPdf = doc.url?.toLowerCase().endsWith('.pdf');
                          return (
                            <div key={i} style={{ padding: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>
                                {isPdf ? '📄 (PDF)' : '🖼️ (Image)'} {doc.docType || 'Government ID'}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {new Date(doc.uploadedAt || Date.now()).toLocaleDateString()}
                              </div>
                              {!isPdf && doc.url && (
                                <img
                                  src={doc.url}
                                  alt="ID Preview"
                                  style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4, border: '1px solid #f1f5f9' }}
                                />
                              )}
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ marginTop: 'auto', padding: '4px 8px', fontSize: 11, textAlign: 'center', textDecoration: 'none' }}
                              >
                                View Full Document
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* OCR Automated Identity Analysis Card (Option 1: Name-based OCR) */}
                  {(() => {
                    const ocr = v.identity?.ocrResult || {};
                    const ocrStatus = ocr.status || (v.identity?.documents?.length ? 'pending' : 'not_submitted');
                    const hasRun = ocrStatus === 'processed';
                    const hasFailed = ocrStatus === 'failed';
                    const docType = ocr.extractedEntities?.extractedDocType || v.identity?.extractedInfo?.documentType || 'Government ID';
                    const extractedName = ocr.extractedEntities?.extractedName || v.identity?.extractedInfo?.name || '—';
                    const storedName = currentProvider?.userId?.name || '—';
                    const isNameMatched = !!ocr.nameMatched;
                    const confidence = ocr.confidence != null ? `${ocr.confidence}%` : '—';
                    const maskedDocNum = ocr.extractedEntities?.extractedDocNumber || v.identity?.extractedInfo?.documentNumber || '—';

                    return (
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            🤖 OCR Identity Intelligence <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>(Name-Based Consistency Check)</span>
                          </span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* OCR Status */}
                            <span style={{
                              padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                              background: hasRun ? '#dcfce7' : hasFailed ? '#fee2e2' : ocrStatus === 'processing' ? '#dbeafe' : '#f1f5f9',
                              color: hasRun ? '#15803d' : hasFailed ? '#b91c1c' : ocrStatus === 'processing' ? '#1d4ed8' : '#64748b',
                            }}>
                              OCR Status: {hasFailed ? 'OCR Failed' : hasRun ? 'Processed' : ocrStatus === 'processing' ? 'Processing' : 'Pending'}
                            </span>

                            {/* OCR Confidence */}
                            <span style={{
                              padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                              background: '#f1f5f9', color: '#475569',
                            }}>
                              OCR Confidence: {confidence}
                            </span>

                            {/* Name Match Status - never 0% */}
                            {hasRun ? (
                              <span style={{
                                padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                                background: isNameMatched ? '#dcfce7' : '#fee2e2',
                                color: isNameMatched ? '#15803d' : '#b91c1c',
                              }}>
                                Name Match: {isNameMatched ? '✓ Match' : '⚠ Mismatch'}
                              </span>
                            ) : hasFailed ? (
                              <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>
                                Name Match: —
                              </span>
                            ) : (
                              <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>
                                Name Match: —
                              </span>
                            )}
                          </div>
                        </div>

                        {/* If OCR Failed */}
                        {hasFailed && (
                          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 10, borderRadius: 6, marginBottom: 8, fontSize: 12, color: '#991b1b' }}>
                            <strong>⚠️ OCR Failed:</strong> Unable to extract readable text from the uploaded document (image may be blurry or glare present).
                            Please manually inspect the document file above to complete verification.
                          </div>
                        )}

                        {/* Extracted Details Grid */}
                        {hasRun ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'white', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                              <div>
                                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Registered Provider Profile</div>
                                <div><strong>Provider Name:</strong> {storedName}</div>
                                <div><strong>Phone:</strong> {currentProvider?.userId?.phone || '—'}</div>
                                <div><strong>City:</strong> {currentProvider?.userId?.address?.city || currentProvider?.serviceArea?.city || '—'}</div>
                              </div>
                              <div>
                                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>OCR Extracted Identity Data</div>
                                <div><strong>Document Type:</strong> {docType}</div>
                                <div>
                                  <strong>Extracted Name:</strong>{' '}
                                  <span style={{ fontWeight: 700, color: isNameMatched ? '#15803d' : '#b91c1c' }}>
                                    {extractedName}
                                  </span>
                                </div>
                                <div>
                                  <strong>Document ID:</strong>{' '}
                                  <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    {maskedDocNum}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Warnings or Success */}
                            {ocr.warnings?.length > 0 ? (
                              <div style={{ background: '#fef3c7', padding: '8px 10px', borderRadius: 6, border: '1px solid #fde68a', color: '#92400e' }}>
                                <strong>⚠️ Name & Identity Comparison Alerts:</strong>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                  {ocr.warnings.map((w, idx) => (
                                    <li key={idx}>{w}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <div style={{ color: '#15803d', fontWeight: 600, background: '#f0fdf4', padding: '6px 10px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                                ✓ Name Match: The name on the document is consistent with the provider profile.
                              </div>
                            )}
                          </div>
                        ) : !hasFailed && (
                          <div style={{ fontSize: 12, color: '#64748b', background: 'white', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            OCR automatically extracts the name from uploaded ID files and compares it with the provider's registered name.
                          </div>
                        )}

                        {/* Explicit Authentication Disclaimer */}
                        <div style={{ marginTop: 8, padding: '6px 10px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 11, color: '#1e40af' }}>
                          ℹ️ <strong>Verification Note:</strong> A successful name match indicates that the uploaded document information is consistent with the provider profile. It does <em>not</em> mean the government document itself has been authenticated. Admin retains final manual decision authority.
                        </div>
                      </div>
                    );
                  })()}

                  {/* Actions & Feedback */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="Identity review notes (e.g. name matches / blurry photo / re-upload required)..."
                      value={categoryNotes.identity || ''}
                      onChange={(e) => setCategoryNotes({ ...categoryNotes, identity: e.target.value })}
                      style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    />
                    <button onClick={() => handleCategoryAction('identity', 'verify')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#22c55e', color: 'white' }}>
                      ✓ Match & Verify
                    </button>
                    <button onClick={() => handleCategoryAction('identity', 'mismatch')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#f59e0b', color: 'white' }}>
                      ⚠ Mismatch
                    </button>
                    <button onClick={() => handleCategoryAction('identity', 'reject')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#ef4444', color: 'white' }}>
                      ✕ Reject
                    </button>
                  </div>
                </div>

                {/* 2. Practical Experience Review */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                      <Briefcase size={18} color="#3b82f6" /> 2. Field Experience (Certificates NOT Mandatory)
                    </div>
                    <div>{getPillarBadge(v.experience?.status || 'not_submitted')}</div>
                  </div>

                  <div style={{ background: 'white', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div><strong>Declared Experience:</strong> {v.experience?.yearsOfExperience ?? currentProvider?.experience ?? 0} years</div>
                    <div><strong>Experience Summary:</strong> {v.experience?.description || 'None provided.'}</div>
                    {v.experience?.previousWorkDetails && <div><strong>Previous Work:</strong> {v.experience.previousWorkDetails}</div>}
                    {v.experience?.previousEmployerOrClient && <div><strong>Employer/Clients:</strong> {v.experience.previousEmployerOrClient}</div>}
                  </div>

                  {/* Uploaded Evidence with Preview */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={15} color="#2563eb" />
                      Uploaded Experience Evidence ({v.experience?.evidenceUrls?.length || 0})
                    </div>
                    {(!v.experience?.evidenceUrls || v.experience.evidenceUrls.length === 0) ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', background: 'white', padding: 10, borderRadius: 6, border: '1px dashed #cbd5e1' }}>
                        No experience evidence files uploaded. Formal certificates are optional for experienced providers.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {v.experience.evidenceUrls.map((ev, i) => {
                          const isPdf = ev.url?.toLowerCase().endsWith('.pdf') || ev.name?.toLowerCase().endsWith('.pdf');
                          return (
                            <div key={i} style={{ padding: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.name || 'Work Proof'}>
                                {isPdf ? '📄 (PDF)' : '🖼️ (Image)'} {ev.name || `Proof #${i+1}`}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {new Date(ev.uploadedAt || Date.now()).toLocaleDateString()}
                              </div>
                              {!isPdf && ev.url && (
                                <img
                                  src={ev.url}
                                  alt="Evidence Preview"
                                  style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4, border: '1px solid #f1f5f9' }}
                                />
                              )}
                              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline btn-sm"
                                  style={{ flex: 1, padding: '4px 8px', fontSize: 11, textAlign: 'center', textDecoration: 'none' }}
                                >
                                  View / Download
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* OCR Extracted Information & Consistency Verification */}
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                        🤖 OCR Automated Document Analysis
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: v.experience?.ocrResult?.status === 'processed' ? '#dcfce7' : v.experience?.ocrResult?.status === 'failed' ? '#fee2e2' : '#f1f5f9',
                        color: v.experience?.ocrResult?.status === 'processed' ? '#15803d' : v.experience?.ocrResult?.status === 'failed' ? '#b91c1c' : '#64748b',
                      }}>
                        Status: {v.experience?.ocrResult?.status || 'Not Applicable'}
                      </span>
                    </div>

                    {v.experience?.ocrResult?.status === 'processed' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                        <div>
                          <strong>OCR Confidence:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>{v.experience.ocrResult.confidence || 85}%</span>
                        </div>
                        {v.experience.ocrResult.extractedEntities?.extractedName && (
                          <div>
                            <strong>Extracted Name:</strong> {v.experience.ocrResult.extractedEntities.extractedName}
                          </div>
                        )}
                        {v.experience.ocrResult.extractedEntities?.extractedOrganization && (
                          <div>
                            <strong>Identified Employer/Client:</strong> {v.experience.ocrResult.extractedEntities.extractedOrganization}
                          </div>
                        )}
                        {v.experience.ocrResult.extractedEntities?.extractedDuration && (
                          <div>
                            <strong>Identified Duration:</strong> {v.experience.ocrResult.extractedEntities.extractedDuration}
                          </div>
                        )}
                        {v.experience.ocrResult.extractedEntities?.extractedDates?.length > 0 && (
                          <div>
                            <strong>Identified Dates:</strong> {v.experience.ocrResult.extractedEntities.extractedDates.join(', ')}
                          </div>
                        )}

                        {/* Warnings / Discrepancy Alerts */}
                        {v.experience.ocrResult.warnings?.length > 0 ? (
                          <div style={{ background: '#fef3c7', padding: '8px 10px', borderRadius: 6, border: '1px solid #fde68a', color: '#92400e', marginTop: 4 }}>
                            <strong>⚠️ Verification Attention Items:</strong>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              {v.experience.ocrResult.warnings.map((w, idx) => (
                                <li key={idx}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div style={{ color: '#15803d', fontWeight: 600, marginTop: 4 }}>
                            ✓ No major discrepancies detected between document and profile.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        OCR analysis triggers when work proof images or certificates are uploaded.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="Experience assessment notes..."
                      value={categoryNotes.experience || ''}
                      onChange={(e) => setCategoryNotes({ ...categoryNotes, experience: e.target.value })}
                      style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    />
                    <button onClick={() => handleCategoryAction('experience', 'verify')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#22c55e', color: 'white' }}>
                      ✓ Verify Experience
                    </button>
                    <button onClick={() => handleCategoryAction('experience', 'reject')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#ef4444', color: 'white' }}>
                      ✕ Reject
                    </button>
                  </div>
                </div>

                {/* 3. Skills Review */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                      <Wrench size={18} color="#3b82f6" /> 3. Skills & Competencies
                    </div>
                    <div>{getPillarBadge(v.skills?.status || 'not_submitted')}</div>
                  </div>

                  <div style={{ background: 'white', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(v.skills?.skillsList?.length ? v.skills.skillsList : (currentProvider?.skills || []).map(s => ({ name: s, yearsOfExperience: 1 }))).map((sk, i) => (
                        <span key={i} style={{ background: '#e0e7ff', color: '#1e40af', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                          {sk.name} ({sk.yearsOfExperience}y)
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="Skills review notes..."
                      value={categoryNotes.skills || ''}
                      onChange={(e) => setCategoryNotes({ ...categoryNotes, skills: e.target.value })}
                      style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    />
                    <button onClick={() => handleCategoryAction('skills', 'verify')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#22c55e', color: 'white' }}>
                      ✓ Verify Skills
                    </button>
                    <button onClick={() => handleCategoryAction('skills', 'reject')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#ef4444', color: 'white' }}>
                      ✕ Reject
                    </button>
                  </div>
                </div>

                {/* 4. Qualification / License */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                      <Award size={18} color="#3b82f6" /> 4. Qualification & Licenses {isLicensed ? '(Mandatory for Electrician)' : '(Optional)'}
                    </div>
                    <div>{getPillarBadge(v.qualification?.status || (isLicensed ? 'not_submitted' : 'not_required'))}</div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    {(!v.qualification?.certificates || v.qualification.certificates.length === 0) ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {isLicensed ? '⚠️ No license uploaded. Electricians must submit credentials.' : 'No formal certificate attached (Optional). This does NOT block approval.'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {v.qualification.certificates.map((cert, i) => (
                          <div key={i} style={{ padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>📜 {cert.docType || 'Certificate'}</span>
                            {cert.url && <a href={cert.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>View File</a>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="Qualification notes..."
                      value={categoryNotes.qualification || ''}
                      onChange={(e) => setCategoryNotes({ ...categoryNotes, qualification: e.target.value })}
                      style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    />
                    <button onClick={() => handleCategoryAction('qualification', 'verify')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#22c55e', color: 'white' }}>
                      ✓ Verify Credential
                    </button>
                    <button onClick={() => handleCategoryAction('qualification', 'reject')} disabled={actionLoading} className="btn btn-sm" style={{ background: '#ef4444', color: 'white' }}>
                      ✕ Reject
                    </button>
                  </div>
                </div>

                {/* Overall Decision Section */}
                <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 16 }}>
                  <label className="label">Rejection / More Info Feedback (Required if rejecting application)</label>
                  <input
                    className="input"
                    placeholder="e.g. Identity Aadhaar name does not match profile name, or upload clearer photo..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    style={{ marginBottom: 16 }}
                  />

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => setSelectedProvider(null)} className="btn btn-outline">
                      Close
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleOverallVerify('rejected')}
                      className="btn btn-outline"
                      style={{ borderColor: '#ef4444', color: '#ef4444' }}
                    >
                      Reject Application
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleOverallVerify('verified')}
                      className="btn btn-primary"
                      style={{ background: '#22c55e', borderColor: '#22c55e', fontWeight: 700 }}
                    >
                      ✓ Approve Provider (Grant Verified Badge)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminVerification;
