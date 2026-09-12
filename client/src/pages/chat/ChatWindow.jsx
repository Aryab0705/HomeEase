import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Send, Image } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Avatar from '../../components/common/Avatar';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { getSocket } from '../../services/socket';
import { timeAgo } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ChatWindow = () => {
  const { chatId } = useParams();
  const { user }   = useSelector(s => s.auth);
  const [chat, setChat]         = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef  = useRef(null);
  const typingTimeout   = useRef(null);
  const fileInputRef    = useRef(null);
  const socket          = getSocket();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, mRes] = await Promise.all([
          API.get(`/chats`, { authRole: user?.role }),
          API.get(`/chats/${chatId}/messages`, { authRole: user?.role }),
        ]);
        const allChats = cRes.data.data || [];
        let found = allChats.find(c => c._id === chatId);
        setChat(found || null);
        setMessages(mRes.data.data.messages || []);
      } catch {
        toast.error('Failed to load chat conversation');
      } finally {
        setLoading(false);
      }
    };
    if (user?.role) load();
  }, [chatId, user?.role]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !chatId) return;
    socket.emit('join_chat', chatId);

    const handleNewMessage = (msg) => {
      setMessages(prev => {
        if (prev.some(m => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    };
    const handleTyping = ({ name, isTyping: t }) => {
      if (name !== user?.name) setIsTyping(t);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleTyping);
      socket.emit('leave_chat', chatId);
    };
  }, [socket, chatId, user?.name]);

  const handleTyping = (val) => {
    setContent(val);
    if (!socket) return;
    socket.emit('typing', { chatId, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit('typing', { chatId, isTyping: false }), 1500);
  };

  const handleSend = async () => {
    if (!content.trim() && !fileInputRef.current?.files[0]) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('content', content);
      if (fileInputRef.current?.files[0]) {
        formData.append('image', fileInputRef.current.files[0]);
      }
      const res = await API.post(`/chats/${chatId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        authRole: user?.role,
      });
      setMessages(prev => {
        if (prev.some(m => String(m._id) === String(res.data.data._id))) return prev;
        return [...prev, res.data.data];
      });
      setContent('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch { toast.error('Failed to send message'); }
    finally  { setSending(false); }
  };

  const getOtherParticipant = () => chat?.participants?.find(p => p._id !== user?._id);
  const other = getOtherParticipant();

  if (loading) return <AppLayout><PageSpinner /></AppLayout>;

  return (
    <AppLayout noPadding>
        <main style={{ flex: 1, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <Avatar src={other?.avatar?.url} name={other?.name} size="md" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{other?.name || 'Chat'}</div>
              {isTyping && <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 500 }}>typing...</div>}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: 40 }}>
                <p style={{ fontSize: 14 }}>No messages yet. Say hello! 👋</p>
              </div>
            )}
            {messages.map(msg => {
              const currentUserId = String(user?._id || user?.id || '');
              const senderId = String(
                msg.senderId?._id ||
                msg.senderId ||
                msg.sender?._id ||
                msg.sender ||
                ''
              );
              const isMine = Boolean(currentUserId && senderId && currentUserId === senderId);

              return (
                <motion.div
                  key={msg._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    width: '100%',
                    justifyContent: isMine ? 'flex-start' : 'flex-end',
                    marginBottom: 8
                  }}
                >
                  <div
                    style={{
                      width: 'fit-content',
                      maxWidth: '70%',
                      padding: '10px 14px',
                      borderRadius: isMine ? '16px 16px 16px 2px' : '16px 16px 2px 16px',
                      background: isMine ? 'var(--dark-accent, #ABC4FF)' : '#FFFFFF',
                      color: isMine ? '#0F172A' : 'var(--text-dark, #1E293B)',
                      border: isMine ? 'none' : '1px solid var(--border, #E2E8F0)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMine ? 'flex-start' : 'flex-end'
                    }}
                  >
                    {msg.type === 'image' && msg.image?.url && (
                      <img src={msg.image.url} alt="sent" style={{ maxWidth: 240, borderRadius: 12, display: 'block', marginBottom: 4 }} />
                    )}
                    {msg.content && (
                      <div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordWrap: 'break-word', wordBreak: 'normal', overflowWrap: 'anywhere' }}>
                        {String(msg.content)}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: isMine ? '#334155' : 'var(--text-light)', marginTop: 3, textAlign: isMine ? 'left' : 'right' }}>
                      {timeAgo(msg.createdAt)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'white', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => handleSend()} />
            <button className="btn btn-icon btn-outline" onClick={() => fileInputRef.current?.click()} title="Send image">
              <Image size={18} />
            </button>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Type a message..."
              value={content}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button className="btn btn-primary btn-icon" onClick={handleSend} disabled={sending || (!content.trim())}>
              <Send size={18} />
            </button>
          </div>
        </main>
    </AppLayout>
  );
};

export default ChatWindow;
