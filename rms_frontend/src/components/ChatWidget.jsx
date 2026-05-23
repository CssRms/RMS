import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  MessageCircle, X, ArrowLeft, Send, Users, MessageSquare,
  ChevronRight, Plus, Loader2
} from 'lucide-react';
import api from '../lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const chatAPI = {
  conversations: () => api.get('/chat/conversations').then(r => r.data),
  group:  (before) => api.get('/chat/group',  { params: before ? { before } : {} }).then(r => r.data),
  dm:     (deptId, before) => api.get(`/chat/dm/${deptId}`, { params: before ? { before } : {} }).then(r => r.data),
  send:   (body, toDeptId) => api.post('/chat/send', { body, ...(toDeptId ? { toDeptId } : {}) }).then(r => r.data),
  read:   (ids) => api.post('/chat/read', { messageIds: ids }).then(r => r.data),
  depts:  () => api.get('/departments').then(r => r.data),
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 8 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-blue-500','bg-emerald-500','bg-purple-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
      {initials}
    </div>
  );
};

// ── Message bubble ────────────────────────────────────────────────────────────
const Bubble = ({ msg, isMe }) => (
  <div className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''}`}>
    {!isMe && <Avatar name={msg.fromDept?.name} size={6} />}
    <div className={`max-w-[75%] space-y-0.5 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
      {!isMe && (
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide pl-1">
          {msg.fromDept?.name}
        </p>
      )}
      <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words ${
        isMe
          ? 'bg-primary text-primary-foreground rounded-br-sm'
          : 'bg-muted text-foreground rounded-bl-sm'
      }`}>
        {msg.body}
      </div>
      <p className="text-[9px] text-muted-foreground/60 px-1">{fmt(msg.createdAt)}</p>
    </div>
  </div>
);

// ── Thread view ───────────────────────────────────────────────────────────────
const ThreadView = ({ thread, myDeptId, onBack, onNewMessage }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const isGroup = thread.type === 'group';

  const load = useCallback(async () => {
    try {
      const data = isGroup
        ? await chatAPI.group()
        : await chatAPI.dm(thread.deptId);
      setMessages(data);
      // Mark unread
      const unread = data.filter(m => m.fromDeptId !== myDeptId && !m.readBy?.includes(myDeptId));
      if (unread.length) chatAPI.read(unread.map(m => m.id)).catch(() => {});
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [thread, isGroup, myDeptId]);

  useEffect(() => { load(); }, [load]);

  // scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      const msg = await chatAPI.send(text, isGroup ? undefined : thread.deptId);
      setMessages(prev => [...prev, msg]);
      onNewMessage?.();
    } catch { toast.error('Failed to send message.'); setInput(text); }
    finally { setSending(false); }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Listen for incoming SSE chat messages while thread is open
  useEffect(() => {
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.detail);
        const belongs = isGroup
          ? !msg.toDeptId
          : (msg.toDeptId && (
              (msg.fromDeptId === thread.deptId && msg.toDeptId === myDeptId) ||
              (msg.fromDeptId === myDeptId && msg.toDeptId === thread.deptId)
            ));
        if (belongs) {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.fromDeptId !== myDeptId) chatAPI.read([msg.id]).catch(() => {});
        }
      } catch {}
    };
    window.addEventListener('rms:chatMessage', handler);
    return () => window.removeEventListener('rms:chatMessage', handler);
  }, [thread, isGroup, myDeptId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
        </button>
        {isGroup
          ? <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Users size={14} className="text-primary" /></div>
          : <Avatar name={thread.deptName} size={8} />
        }
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate">{isGroup ? 'All Departments' : thread.deptName}</p>
          <p className="text-[10px] text-muted-foreground">{isGroup ? 'Visible to all departments' : 'Direct message'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
        {loading && (
          <div className="flex justify-center pt-6"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center pt-8">
            <MessageSquare size={28} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map(msg => (
          <Bubble key={msg.id} msg={msg} isMe={msg.fromDeptId === myDeptId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/40 shrink-0">
        <div className="flex items-end gap-2 bg-muted/40 rounded-2xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground resize-none outline-none max-h-[80px] leading-relaxed"
            style={{ minHeight: '24px' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-all disabled:opacity-40 shrink-0 hover:bg-primary/90"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/50 text-center mt-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
};

// ── New DM picker ─────────────────────────────────────────────────────────────
const NewDMView = ({ myDeptId, onSelect, onBack }) => {
  const [depts, setDepts] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    chatAPI.depts().then(d => setDepts(d.filter(x => x.id !== myDeptId))).catch(() => {});
  }, [myDeptId]);

  const filtered = depts.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} />
        </button>
        <p className="font-bold text-sm text-foreground">New Message</p>
      </div>
      <div className="px-4 py-2 border-b border-border/20 shrink-0">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search departments…"
          className="w-full text-sm bg-muted/40 rounded-xl px-3 py-2 outline-none placeholder-muted-foreground focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.map(d => (
          <button key={d.id} onClick={() => onSelect(d)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left border-b border-border/10">
            <Avatar name={d.name} size={8} />
            <span className="text-sm font-semibold text-foreground">{d.name}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center pt-8">No departments found</p>
        )}
      </div>
    </div>
  );
};

// ── Inbox screen ──────────────────────────────────────────────────────────────
const InboxView = ({ myDeptId, onOpenThread, onNewDM, conversations, loading }) => {
  const { group, dms } = conversations;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
        <p className="font-black text-sm text-foreground uppercase tracking-wide">Messages</p>
        <button onClick={onNewDM}
          className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
          title="New direct message">
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && (
          <div className="flex justify-center pt-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
        )}

        {!loading && (
          <>
            {/* Group channel */}
            <button onClick={() => onOpenThread({ type: 'group' })}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors border-b border-border/20 text-left">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Users size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm text-foreground">All Departments</p>
                  {group?.lastMessage && (
                    <p className="text-[10px] text-muted-foreground shrink-0">{fmt(group.lastMessage.createdAt)}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {group?.lastMessage
                    ? `${group.lastMessage.fromDept?.name}: ${group.lastMessage.body}`
                    : 'Shared channel for all departments'}
                </p>
              </div>
              {group?.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-black text-primary-foreground shrink-0">
                  {group.unread > 9 ? '9+' : group.unread}
                </span>
              )}
            </button>

            {/* DM threads */}
            {dms.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Direct Messages</p>
                {dms.map(dm => (
                  <button key={dm.deptId}
                    onClick={() => onOpenThread({ type: 'dm', deptId: dm.deptId, deptName: dm.deptName })}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/10 text-left">
                    <Avatar name={dm.deptName} size={10} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm text-foreground">{dm.deptName}</p>
                        {dm.lastMessage && (
                          <p className="text-[10px] text-muted-foreground shrink-0">{fmt(dm.lastMessage.createdAt)}</p>
                        )}
                      </div>
                      {dm.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {dm.lastMessage.fromDeptId === myDeptId ? 'You: ' : ''}{dm.lastMessage.body}
                        </p>
                      )}
                    </div>
                    {dm.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-black text-primary-foreground shrink-0">
                        {dm.unread > 9 ? '9+' : dm.unread}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {dms.length === 0 && !group?.lastMessage && (
              <div className="flex flex-col items-center justify-center gap-3 pt-12 px-6 text-center">
                <MessageCircle size={32} className="text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No messages yet. Start a conversation with a department or post to the group channel.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main ChatWidget ───────────────────────────────────────────────────────────
export default function ChatWidget({ initialDeepLink, onDeepLinkConsumed }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState('inbox'); // 'inbox' | 'thread' | 'new'
  const [activeThread, setActiveThread] = useState(null);
  const [conversations, setConversations] = useState({ group: { unread: 0, lastMessage: null }, dms: [] });
  const [convLoading, setConvLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const myDeptId = user?.deptId ? parseInt(user.deptId) : null;

  // Only show for department accounts
  if (!user || user.role !== 'department' || !myDeptId) return null;

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const data = await chatAPI.conversations();
      setConversations(data);
      const unread = (data.group?.unread || 0) + data.dms.reduce((s, d) => s + (d.unread || 0), 0);
      setTotalUnread(unread);
    } catch {}
    finally { setConvLoading(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Refresh conversations every 30s when widget is closed
  useEffect(() => {
    if (open) return;
    const t = setInterval(loadConversations, 30000);
    return () => clearInterval(t);
  }, [open, loadConversations]);

  // Handle incoming SSE chat_message events
  useEffect(() => {
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.detail);
        if (msg.fromDeptId === myDeptId) return; // own message
        loadConversations();
        // If widget is open and we're already in the right thread, don't toast
        const inRightThread = open && screen === 'thread' && (
          (!msg.toDeptId && activeThread?.type === 'group') ||
          (msg.toDeptId && activeThread?.type === 'dm' && activeThread?.deptId === msg.fromDeptId)
        );
        if (!inRightThread) {
          const label = msg.toDeptId ? msg.fromDept?.name : `📢 ${msg.fromDept?.name} (All)`;
          toast(
            (t) => (
              <button onClick={() => {
                toast.dismiss(t.id);
                openThread(msg.toDeptId ? { type: 'dm', deptId: msg.fromDeptId, deptName: msg.fromDept?.name } : { type: 'group' });
              }} className="text-left w-full">
                <p className="font-bold text-xs">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{msg.body}</p>
              </button>
            ),
            { icon: '💬', duration: 5000 }
          );
        }
      } catch {}
    };
    window.addEventListener('rms:chatMessage', handler);
    return () => window.removeEventListener('rms:chatMessage', handler);
  }, [open, screen, activeThread, myDeptId, loadConversations]);

  // Handle deep-link from notification click (e.g. ?chat=dm:5 or ?chat=group)
  useEffect(() => {
    const link = initialDeepLink;
    if (!link) return;
    if (link === 'group') {
      openThread({ type: 'group' });
    } else if (link.startsWith('dm:')) {
      const deptId = parseInt(link.slice(3));
      if (!isNaN(deptId)) openThread({ type: 'dm', deptId, deptName: '' });
    }
    onDeepLinkConsumed?.();
  }, [initialDeepLink]);

  const openThread = (thread) => {
    setActiveThread(thread);
    setScreen('thread');
    setOpen(true);
  };

  const handleOpenInbox = () => {
    setScreen('inbox');
    setOpen(true);
    loadConversations();
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpenInbox}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95"
        title="Messages"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 border-2 border-background flex items-center justify-center text-[9px] font-black text-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] h-[520px] bg-card border border-border/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {screen === 'inbox' && (
            <InboxView
              myDeptId={myDeptId}
              conversations={conversations}
              loading={convLoading}
              onOpenThread={openThread}
              onNewDM={() => setScreen('new')}
            />
          )}
          {screen === 'thread' && activeThread && (
            <ThreadView
              thread={activeThread}
              myDeptId={myDeptId}
              onBack={() => { setScreen('inbox'); loadConversations(); }}
              onNewMessage={loadConversations}
            />
          )}
          {screen === 'new' && (
            <NewDMView
              myDeptId={myDeptId}
              onBack={() => setScreen('inbox')}
              onSelect={(dept) => openThread({ type: 'dm', deptId: dept.id, deptName: dept.name })}
            />
          )}
        </div>
      )}
    </>
  );
}
