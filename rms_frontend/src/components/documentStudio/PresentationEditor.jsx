import React, { useState, useRef, useCallback, useEffect } from 'react';
import DOMPurify from 'dompurify';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PptxGenJS from 'pptxgenjs';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { toast } from 'react-hot-toast';
import { ExportMenu, ExportConfirmModal, SaveIndicator } from './shared';
import {
  Plus, Trash2, MonitorPlay, ChevronLeft, ChevronRight, Presentation, File, X,
} from 'lucide-react';

const PresentationEditor = ({ loadedDraft, onAutosave }) => {
  const [title, setTitle] = useState(loadedDraft?.title || 'Untitled Presentation');
  const [saving, setSaving] = useState(false);
  const [slides, setSlides] = useState(loadedDraft?.data || [{ id: Date.now(), html: '<h1 class="ql-align-center">New Slide</h1>' }]);
  const [activeSlideId, setActiveSlideId] = useState(slides[0]?.id || Date.now());
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);

  const editorRef = useRef(null);
  const quillInstance = useRef(null);
  const presentAreaRef = useRef(null);

  // Initialize Quill
  useEffect(() => {
    if (!editorRef.current || quillInstance.current || presenting) return;

    quillInstance.current = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'align': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          [{ 'indent': '-1' }, { 'indent': '+1' }],
          ['blockquote', 'link'],
          ['image', 'video'],
          ['clean']
        ]
      }
    });

    quillInstance.current.on('text-change', () => {
      const html = quillInstance.current.root.innerHTML;
      setSlides(prev => prev.map(s => s.id === activeSlideId ? { ...s, html } : s));
    });
  }, [activeSlideId, presenting]);

  // Load active slide content into quill
  useEffect(() => {
    if (quillInstance.current) {
      const currentSlide = slides.find(s => s.id === activeSlideId);
      if (currentSlide && quillInstance.current.root.innerHTML !== currentSlide.html) {
        quillInstance.current.root.innerHTML = DOMPurify.sanitize(currentSlide.html || '');
      }
    }
  }, [activeSlideId]);

  // Autosave
  useEffect(() => {
    if (presenting) return; // Don't autosave while presenting to avoid lag
    setSaving(true);
    const timer = setTimeout(() => {
      onAutosave({ title, data: slides });
      setSaving(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [slides, title]);

  const addSlide = () => {
    const newSlide = { id: Date.now(), html: '<h2 class="ql-align-center">New Slide</h2>' };
    setSlides([...slides, newSlide]);
    setActiveSlideId(newSlide.id);
  };

  const removeSlide = (id) => {
    if (slides.length === 1) return;
    const remaining = slides.filter(s => s.id !== id);
    setSlides(remaining);
    if (activeSlideId === id) setActiveSlideId(remaining[0].id);
  };

  // Fullscreen Presentation Logic
  const startPresentation = () => {
    setPresentIndex(slides.findIndex(s => s.id === activeSlideId) || 0);
    setPresenting(true);
    setTimeout(() => {
      if (presentAreaRef.current) {
        presentAreaRef.current.requestFullscreen().catch(err => console.error("Fullscreen err:", err));
      }
    }, 100);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    const handleKeyDown = (e) => {
      if (!presenting) return;
      if (e.key === 'ArrowRight' || e.key === ' ') setPresentIndex(i => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setPresentIndex(i => Math.max(i - 1, 0));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [presenting, slides.length]);

  const [exportType, setExportType] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Renders each slide's HTML off-screen at fixed 16:9 dimensions and captures it as an image,
  // since only the active slide is mounted in the live Quill editor at any given time.
  const captureSlideImages = useCallback(async () => {
    const images = [];
    for (const slide of slides) {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '960px';
      container.style.height = '540px';
      container.style.background = '#ffffff';
      container.style.padding = '48px';
      container.style.boxSizing = 'border-box';
      container.className = 'ql-editor';
      container.innerHTML = DOMPurify.sanitize(slide.html || '');
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
      images.push(canvas.toDataURL('image/png'));
      document.body.removeChild(container);
    }
    return images;
  }, [slides]);

  const handleConfirmExport = useCallback(async () => {
    if (!exportType) return;
    setExporting(true);
    try {
      const images = await captureSlideImages();
      if (exportType === 'pptx') {
        const pptx = new PptxGenJS();
        pptx.defineLayout({ name: 'RMS_16x9', width: 10, height: 5.63 });
        pptx.layout = 'RMS_16x9';
        images.forEach(imgData => {
          const s = pptx.addSlide();
          s.addImage({ data: imgData, x: 0, y: 0, w: 10, h: 5.63 });
        });
        await pptx.writeFile({ fileName: `${title}.pptx` });
      } else if (exportType === 'pdf') {
        const pdf = new jsPDF({ unit: 'pt', format: [960, 540], orientation: 'landscape' });
        images.forEach((imgData, idx) => {
          if (idx > 0) pdf.addPage([960, 540], 'landscape');
          pdf.addImage(imgData, 'PNG', 0, 0, 960, 540);
        });
        pdf.save(`${title}.pdf`);
      }
      toast.success('Presentation exported and saved locally.');
      setExportType(null);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exportType, title, captureSlideImages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2 w-full max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-black text-foreground bg-transparent outline-none border-b-2 border-transparent focus:border-primary/50 transition-all pb-1 w-full max-w-lg"
            placeholder="Presentation Title..."
          />
          <SaveIndicator saving={saving} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={startPresentation} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20">
            <MonitorPlay size={16} />
            <span>Present</span>
          </button>
          <ExportMenu
            onExport={(type) => setExportType(type)}
            formats={[
              { type: 'pptx', label: 'Export as PowerPoint (.pptx)', icon: Presentation },
              { type: 'pdf', label: 'Export as PDF', icon: File },
            ]}
          />
        </div>
      </div>

      <div className="glass bg-white/70 border border-border/50 rounded-2xl flex overflow-hidden shadow-sm h-[600px] relative">
        {/* Left Sidebar: Slides */}
        <div className="w-56 bg-muted/10 border-r border-border/50 flex flex-col z-20">
          <div className="p-3 border-b border-border/50">
            <button onClick={addSlide} className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-muted border border-border/60 shadow-sm text-foreground font-bold text-xs py-2 rounded-lg transition-all">
              <Plus size={14} /> <span>New Slide</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {slides.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => setActiveSlideId(s.id)}
                className={`relative group cursor-pointer border-2 rounded-xl aspect-[4/3] flex flex-col overflow-hidden transition-all ${activeSlideId === s.id ? 'border-primary shadow-md' : 'border-border/60 hover:border-primary/40 bg-white/50'}`}
              >
                <div className="bg-muted/30 px-2 py-1 flex items-center justify-between border-b border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                  {slides.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removeSlide(s.id); }} className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="flex-1 p-2 scale-[0.35] origin-top-left w-[280%] h-[280%] pointer-events-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(s.html || '') }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col bg-muted/5 z-10">
          {!presenting && <div ref={editorRef} className="flex-1 border-none bg-white font-sans" />}
        </div>
      </div>

      {/* Presentation Fullscreen Node */}
      <div
        ref={presentAreaRef}
        className={`fixed inset-0 bg-black z-[9999] flex flex-col ${presenting ? 'block' : 'hidden'}`}
      >
        <div className="flex-1 flex items-center justify-center p-8 relative">
          <div
            className="w-full max-w-6xl aspect-[16/9] bg-white rounded-xl shadow-2xl p-12 overflow-hidden ql-editor"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(slides[presentIndex]?.html || '') }}
          />

          {/* Controls overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full text-white opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={() => setPresentIndex(i => Math.max(i - 1, 0))} disabled={presentIndex === 0} className="p-2 hover:bg-white/20 rounded-full disabled:opacity-30"><ChevronLeft size={24} /></button>
            <span className="font-mono text-sm font-bold">{presentIndex + 1} / {slides.length}</span>
            <button onClick={() => setPresentIndex(i => Math.min(i + 1, slides.length - 1))} disabled={presentIndex === slides.length - 1} className="p-2 hover:bg-white/20 rounded-full disabled:opacity-30"><ChevronRight size={24} /></button>
            <div className="w-px h-6 bg-white/20 mx-2"></div>
            <button onClick={() => document.exitFullscreen()} className="p-2 hover:bg-white/20 rounded-full"><X size={20} /></button>
          </div>
        </div>
      </div>

      <ExportConfirmModal
        open={!!exportType}
        title={`Export "${title}" as ${exportType === 'pptx' ? 'PowerPoint (.pptx)' : 'PDF'}`}
        exporting={exporting}
        onConfirm={handleConfirmExport}
        onClose={() => setExportType(null)}
      >
        <div className="grid grid-cols-3 gap-3">
          {slides.map((s, idx) => (
            <div key={s.id} className="border border-border/40 rounded-lg bg-white aspect-[16/9] overflow-hidden relative">
              <span className="absolute top-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">{idx + 1}</span>
              <div className="scale-[0.3] origin-top-left w-[333%] h-[333%] pointer-events-none p-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(s.html || '') }} />
            </div>
          ))}
        </div>
        {exporting && <p className="text-xs text-muted-foreground mt-3">Rendering {slides.length} slide{slides.length > 1 ? 's' : ''}...</p>}
      </ExportConfirmModal>
    </div>
  );
};

export default PresentationEditor;
