import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  MessageCircle, X, ArrowLeft, Send, Users, MessageSquare,
  ChevronRight, Plus, Loader2, Mic, StopCircle, Paperclip,
  FileText, Download
} from 'lucide-react';
import api from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

const fmtRecTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const msgPreviewText = (m, myDeptId) => {
  if (!m) return '';
  const prefix = m.fromDeptId === myDeptId ? 'You: ' : '';
  if (m.mediaType === 'audio' && !m.body) return prefix + '🎤 Voice message';
  if (m.mediaType === 'image' && !m.body) return prefix + '📷 Image';
  if (m.mediaType === 'file' && !m.body) return `${prefix}📎 ${m.mediaName || 'File'}`;
  return prefix + (m.body || '');
};

const chatAPI = {
  conversations: () => api.get('/chat/conversations'),
  group:  (before) => api.get('/chat/group',  { params: before ? { before } : {} }),
  dm:     (deptId, before) => api.get(`/chat/dm/${deptId}`, { params: before ? { before } : {} }),
  send:   (body, toDeptId, mediaKey, mediaType, mediaName, mediaMime) =>
    api.post('/chat/send', {
      body: body || '',
      ...(toDeptId ? { toDeptId } : {}),
      ...(mediaKey ? { mediaKey, mediaType, mediaName, mediaMime } : {})
    }),
  read:   (ids) => api.post('/chat/read', { messageIds: ids }),
  depts:  () => api.get('/departments'),
  upload: (formData) => api.post('/chat/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  mediaUrl: (key, download = false) =>
    `${API_BASE}/chat/media?key=${encodeURIComponent(key)}${download ? '&download=1' : ''}`,
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
const Bubble = ({ msg, isMe }) => {
  const mediaUrl = msg.mediaKey ? chatAPI.mediaUrl(msg.mediaKey) : null;
  const downloadUrl = msg.mediaKey ? chatAPI.mediaUrl(msg.mediaKey, true) : null;

  return (
    <div className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && <Avatar name={msg.fromDept?.name} size={6} />}
      <div className={`max-w-[75%] space-y-0.5 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && (
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide pl-1">
            {msg.fromDept?.name}
          </p>
        )}
        <div className={`rounded-2xl overflow-hidden ${
          isMe
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}>
          {/* Image */}
          {msg.mediaType === 'image' && mediaUrl && (
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="block">
              <img
                src={mediaUrl}
                alt={msg.mediaName || 'image'}
                className="max-w-full max-h-[220px] w-full object-cover"
              />
            </a>
          )}
          {/* Audio / voice note */}
          {msg.mediaType === 'audio' && mediaUrl && (
            <div className={`flex items-center gap-2 px-3 py-2 ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}>
              <Mic size={13} className="shrink-0 opacity-60" />
              <audio controls src={mediaUrl} className="h-7" style={{ minWidth: 0, maxWidth: '180px' }} />
            </div>
          )}
          {/* Generic file */}
          {msg.mediaType === 'file' && downloadUrl && (
            <a
              href={downloadUrl}
              download={msg.mediaName}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 px-3 py-2.5 hover:opacity-75 transition-opacity ${
                isMe ? 'text-primary-foreground' : 'text-foreground'
              }`}
            >
              <FileText size={15} className="shrink-0 opacity-70" />
              <span className="text-[12px] font-medium truncate max-w-[140px]">{msg.mediaName || 'File'}</span>
              <Download size={11} className="shrink-0 opacity-60" />
            </a>
          )}
          {/* Text body */}
          {msg.body ? (
            <p className={`px-3 py-2 text-[13px] leading-relaxed break-words ${msg.mediaKey ? 'pt-1' : ''}`}>
              {msg.body}
            </p>
          ) : !msg.mediaKey && (
            <p className="px-3 py-2 text-[13px] leading-relaxed break-words italic opacity-50">
              (empty)
            </p>
          )}
        </div>
        <p className="text-[9px] text-muted-foreground/60 px-1">{fmt(msg.createdAt)}</p>
      </div>
    </div>
  );
};

// ── Thread view ───────────────────────────────────────────────────────────────
const ThreadView = ({ thread, myDeptId, onBack, onNewMessage }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Media attachment state
  const [pendingFile, setPendingFile] = useState(null); // { file, url, type }
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const isGroup = thread.type === 'group';

  const load = useCallback(async () => {
    try {
      const data = isGroup
        ? await chatAPI.group()
        : await chatAPI.dm(thread.deptId);
      setMessages(data);
      const unread = data.filter(m => m.fromDeptId !== myDeptId && !m.readBy?.includes(myDeptId));
      if (unread.length) chatAPI.read(unread.map(m => m.id)).catch(() => {});
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [thread, isGroup, myDeptId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Recording timer
  useEffect(() => {
    if (!recording) { setRecSecs(0); return; }
    const t = setInterval(() => setRecSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // Listen for incoming SSE messages
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

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (pendingFile?.url) URL.revokeObjectURL(pendingFile.url);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []); // eslint-disable-line

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    setPendingFile({ file, url: isImg ? URL.createObjectURL(file) : null, type: isImg ? 'image' : 'file' });
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start(250);
      setRecording(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') toast.error('Microphone permission denied.');
      else toast.error('Could not start recording.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const cancelPending = () => {
    if (pendingFile?.url) URL.revokeObjectURL(pendingFile.url);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setPendingFile(null);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const send = async () => {
    const text = input.trim();
    const hasMedia = !!(pendingFile || audioBlob);
    if ((!text && !hasMedia) || sending || recording) return;
    setSending(true);
    const savedInput = text;
    setInput('');

    try {
      let mediaKey = null, mediaType = null, mediaName = null, mediaMime = null;

      if (pendingFile) {
        const fd = new FormData();
        fd.append('file', pendingFile.file);
        const up = await chatAPI.upload(fd);
        mediaKey = up.key; mediaType = up.type; mediaName = up.name; mediaMime = up.mime;
      } else if (audioBlob) {
        const ext = audioBlob.type.includes('ogg') ? 'ogg'
          : audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
        const fd = new FormData();
        fd.append('file', audioBlob, `voice-${Date.now()}.${ext}`);
        const up = await chatAPI.upload(fd);
        mediaKey = up.key; mediaType = 'audio'; mediaName = up.name; mediaMime = audioBlob.type;
      }

      const msg = await chatAPI.send(text, isGroup ? undefined : thread.deptId, mediaKey, mediaType, mediaName, mediaMime);
      setMessages(prev => [...prev, msg]);
      if (pendingFile?.url) URL.revokeObjectURL(pendingFile.url);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setPendingFile(null);
      setAudioBlob(null);
      setAudioUrl(null);
      onNewMessage?.();
    } catch {
      toast.error('Failed to send message.');
      setInput(savedInput);
    }
    finally { setSending(false); }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

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

      {/* Pending media preview */}
      {(pendingFile || audioUrl) && (
        <div className="px-3 pt-2 shrink-0">
          <div className="relative inline-flex items-center gap-2 bg-muted/60 border border-border/40 rounded-xl px-2.5 py-1.5 max-w-full">
            {pendingFile?.type === 'image' && pendingFile.url && (
              <img src={pendingFile.url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
            )}
            {pendingFile?.type === 'file' && <FileText size={15} className="text-muted-foreground shrink-0" />}
            {audioUrl && (
              <>
                <Mic size={13} className="text-primary shrink-0" />
                <audio controls src={audioUrl} className="h-6 max-w-[140px]" />
              </>
            )}
            {pendingFile && (
              <span className="text-xs text-foreground truncate max-w-[120px]">{pendingFile.file.name}</span>
            )}
            <button
              onClick={cancelPending}
              className="w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:bg-rose-100 hover:text-rose-500 transition-colors shrink-0 ml-1"
            >
              <X size={9} />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-3 border-t border-border/40 shrink-0">
        <div className="flex items-end gap-1.5 bg-muted/40 rounded-2xl px-3 py-2">
          {/* File / image attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!audioBlob || recording}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0 mb-0.5 disabled:opacity-30"
            title="Attach file or image"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={recording ? 'Recording…' : 'Type a message…'}
            disabled={recording}
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground resize-none outline-none max-h-[80px] leading-relaxed disabled:opacity-40"
            style={{ minHeight: '24px' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
            }}
          />

          {/* Mic button + timer */}
          {recording && (
            <span className="text-[10px] font-mono text-rose-500 shrink-0 mb-0.5 tabular-nums">
              {fmtRecTime(recSecs)}
            </span>
          )}
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={!!pendingFile || sending}
            className={`shrink-0 mb-0.5 transition-colors disabled:opacity-30 ${
              recording ? 'text-rose-500 animate-pulse' : 'text-muted-foreground hover:text-primary'
            }`}
            title={recording ? 'Stop recording' : 'Record voice note'}
          >
            {recording ? <StopCircle size={16} /> : <Mic size={16} />}
          </button>

          {/* Send button */}
          <button
            type="button"
            onClick={send}
            disabled={(!input.trim() && !pendingFile && !audioBlob) || sending || recording}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-all disabled:opacity-40 shrink-0 hover:bg-primary/90"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/50 text-center mt-1">
          Enter to send · Shift+Enter for new line
        </p>
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
                    ? msgPreviewText(group.lastMessage, myDeptId)
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
                          {msgPreviewText(dm.lastMessage, myDeptId)}
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

  const myDeptId = user?.deptId ? parseInt(user.deptId) : null;
  const isActive = !!(user && user.role === 'department' && myDeptId);

  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState('inbox'); // 'inbox' | 'thread' | 'new'
  const [activeThread, setActiveThread] = useState(null);
  const [conversations, setConversations] = useState({ group: { unread: 0, lastMessage: null }, dms: [] });
  const [convLoading, setConvLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const loadConversations = useCallback(async () => {
    if (!isActive) return;
    setConvLoading(true);
    try {
      const data = await chatAPI.conversations();
      if (data && typeof data === 'object') {
        setConversations(data);
        const unread = (data.group?.unread || 0) + (data.dms || []).reduce((s, d) => s + (d.unread || 0), 0);
        setTotalUnread(unread);
      }
    } catch {}
    finally { setConvLoading(false); }
  }, [isActive]);

  useEffect(() => {
    if (isActive) loadConversations();
  }, [isActive, loadConversations]);

  // Refresh every 30s when widget is closed
  useEffect(() => {
    if (!isActive || open) return;
    const t = setInterval(loadConversations, 30000);
    return () => clearInterval(t);
  }, [isActive, open, loadConversations]);

  // Handle incoming SSE chat_message events
  useEffect(() => {
    if (!isActive) return;
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.detail);
        if (msg.fromDeptId === myDeptId) return;
        loadConversations();
        const inRightThread = open && screen === 'thread' && (
          (!msg.toDeptId && activeThread?.type === 'group') ||
          (msg.toDeptId && activeThread?.type === 'dm' && activeThread?.deptId === msg.fromDeptId)
        );
        if (!inRightThread) {
          const label = msg.toDeptId ? msg.fromDept?.name : `📢 ${msg.fromDept?.name} (All)`;
          const preview = msgPreviewText(msg, myDeptId);
          toast(
            (t) => (
              <button onClick={() => {
                toast.dismiss(t.id);
                openThread(msg.toDeptId
                  ? { type: 'dm', deptId: msg.fromDeptId, deptName: msg.fromDept?.name }
                  : { type: 'group' });
              }} className="text-left w-full">
                <p className="font-bold text-xs">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{preview}</p>
              </button>
            ),
            { icon: '💬', duration: 5000 }
          );
        }
      } catch {}
    };
    window.addEventListener('rms:chatMessage', handler);
    return () => window.removeEventListener('rms:chatMessage', handler);
  }, [isActive, open, screen, activeThread, myDeptId, loadConversations]);

  // Handle deep-link from notification click (?chat=group or ?chat=dm:5)
  useEffect(() => {
    const link = initialDeepLink;
    if (!link || !isActive) return;
    if (link === 'group') {
      openThread({ type: 'group' });
    } else if (link.startsWith('dm:')) {
      const deptId = parseInt(link.slice(3));
      if (!isNaN(deptId)) openThread({ type: 'dm', deptId, deptName: '' });
    }
    onDeepLinkConsumed?.();
  }, [initialDeepLink, isActive]);

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

  if (!isActive) return null;

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
        <div className="fixed bottom-24 right-6 z-50 w-[340px] h-[540px] bg-card border border-border/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
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
