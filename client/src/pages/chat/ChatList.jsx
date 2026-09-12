import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Search } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Avatar from '../../components/common/Avatar';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { useSelector } from 'react-redux';
import { timeAgo } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ChatList = () => {
  const navigate = useNavigate();
  const { user } = useSelector(s => s.auth);
  const [chats, setChats]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/chats', { authRole: user?.role });
        setChats(res.data.data || []);
      } catch { toast.error('Failed to load chats'); }
      finally  { setLoading(false); }
    };
    if (user?.role) load();
  }, [user?.role]);

  const getOther = (chat) => chat.participants?.find(p => p._id !== user?._id);

  const filtered = chats.filter(c => {
    const other = getOther(c);
    return search === '' || other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <AppLayout noPadding>
        <main style={{ flex: 1, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'white', flexShrink: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Messages</h1>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Chat list */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            {loading ? <PageSpinner /> : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64 }}>
                <MessageSquare size={48} color="var(--border)" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, marginBottom: 6 }}>No conversations yet</h3>
                <p style={{ fontSize: 13, color: 'var(--text-light)' }}>Book a service to start chatting with providers.</p>
              </div>
            ) : filtered.map((chat, i) => {
              const other = getOther(chat);
              const lastMsg = chat.lastMessage;

              return (
                <motion.div key={chat._id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/chat/${chat._id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'white', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <Avatar src={other?.avatar?.url} name={other?.name} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{other?.name || 'Chat'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
                        {chat.lastMessageAt ? timeAgo(chat.lastMessageAt) : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lastMsg?.content || 'Start a conversation...'}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </main>
    </AppLayout>
  );
};

export default ChatList;
