import React, { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Upload, Trash2, Search, Loader2, CheckCircle2,
  AlertCircle, FileText, ChevronDown, ChevronUp, X, Play,
  RefreshCw, Clock, Database,
} from 'lucide-react';

const API = '/api';

function getSession() {
  try { return JSON.parse(localStorage.getItem('tax_platform_session') ?? 'null'); }
  catch { return null; }
}

function headers() {
  const s = getSession();
  return s?.id ? { 'x-user-id': s.id } : {};
}

interface Document {
  id: string;
  title: string | null;
  fileName: string | null;
  processingStatus: 'pending' | 'extracting' | 'embedding' | 'saving' | 'completed' | 'failed';
  chunkCount: number;
  jurisdiction: string | null;
  documentCategory: string | null;
  versionLabel: string | null;
  uploadedAt: string;
  metadata: Record<string, unknown>;
}

interface SearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  section_title: string | null;
  similarity?: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-slate-100 text-slate-600 border-slate-200',
  extracting: 'bg-blue-100 text-blue-700 border-blue-200',
  embedding:  'bg-violet-100 text-violet-700 border-violet-200',
  saving:     'bg-amber-100 text-amber-700 border-amber-200',
  completed:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed:     'bg-rose-100 text-rose-700 border-rose-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock className="h-3 w-3" />,
  extracting: <Loader2 className="h-3 w-3 animate-spin" />,
  embedding:  <Loader2 className="h-3 w-3 animate-spin" />,
  saving:     <Loader2 className="h-3 w-3 animate-spin" />,
  completed:  <CheckCircle2 className="h-3 w-3" />,
  failed:     <AlertCircle className="h-3 w-3" />,
};

interface ProcessProgress {
  step: string;
  message: string;
  progress?: number;
  chunkCount?: number;
  pageCount?: number;
  error?: string;
}

export default function KnowledgePage() {
  const qc = useQueryClient();

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processLog, setProcessLog] = useState<ProcessProgress[]>([]);
  const [processDone, setProcessDone] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { data: docs, isLoading } = useQuery<Document[]>({
    queryKey: ['rag-docs'],
    queryFn: async () => {
      const r = await fetch(`${API}/rag/documents`, { headers: headers() });
      if (!r.ok) throw new Error('Failed to load documents');
      return r.json();
    },
    refetchInterval: processingId ? 3000 : false,
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [processLog]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('title', uploadTitle || uploadFile.name.replace('.pdf', ''));
      fd.append('jurisdiction', 'Uganda');
      fd.append('documentCategory', 'tax_law');

      const r = await fetch(`${API}/rag/upload`, {
        method: 'POST',
        headers: headers(),
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Upload failed');

      qc.invalidateQueries({ queryKey: ['rag-docs'] });
      setUploadFile(null);
      setUploadTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleProcess(docId: string) {
    setProcessingId(docId);
    setProcessLog([]);
    setProcessDone(false);

    const es = new EventSource(`${API}/rag/process/${docId}`);
    es.onmessage = (event) => {
      if (event.data === '[DONE]') {
        es.close();
        setProcessingId(null);
        setProcessDone(true);
        qc.invalidateQueries({ queryKey: ['rag-docs'] });
        return;
      }
      try {
        const d = JSON.parse(event.data) as ProcessProgress;
        setProcessLog(prev => [...prev, d]);
      } catch { /* ignore malformed */ }
    };
    es.onerror = () => {
      es.close();
      setProcessingId(null);
      setProcessLog(prev => [...prev, { step: 'error', message: 'Connection lost. Check server logs.' }]);
    };
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document and all its chunks? This cannot be undone.')) return;
    setDeletingId(docId);
    try {
      await fetch(`${API}/rag/documents/${docId}`, {
        method: 'DELETE',
        headers: headers(),
      });
      qc.invalidateQueries({ queryKey: ['rag-docs'] });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResults(null);
    try {
      const r = await fetch(`${API}/rag/search`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 8 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Search failed');
      setSearchResults(data.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  const lastLog = processLog[processLog.length - 1];

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Tax Knowledge Base
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Upload Uganda tax law PDFs, extract and embed for semantic search and AI-assisted advisory.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Left: Upload + Documents */}
          <div className="space-y-5">

            {/* Upload */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                <Upload className="h-4 w-4 text-primary" />
                Upload PDF
              </h2>
              <form onSubmit={handleUpload} className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Document Title (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="e.g. Uganda Income Tax Act 2024"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    PDF File <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                  />
                  {uploadFile && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {uploadFile.name} — {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  )}
                </div>
                {uploadError && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5" /> {uploadError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </span>
                  ) : 'Upload to Storage'}
                </button>
              </form>
            </section>

            {/* Documents List */}
            <section className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Database className="h-4 w-4 text-primary" />
                  Documents
                  {docs && <span className="ml-1 text-xs font-normal text-muted-foreground">({docs.length})</span>}
                </h2>
                <button
                  onClick={() => qc.invalidateQueries({ queryKey: ['rag-docs'] })}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading…</span>
                </div>
              ) : !docs?.length ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No documents yet. Upload a PDF to get started.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {docs.map(doc => {
                    const statusColor = STATUS_COLORS[doc.processingStatus] ?? STATUS_COLORS.pending;
                    const statusIcon = STATUS_ICONS[doc.processingStatus];
                    const isProcessing = processingId === doc.id;
                    const isDeleting = deletingId === doc.id;

                    return (
                      <div key={doc.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <p className="truncate text-sm font-semibold text-foreground">
                                {doc.title || doc.fileName}
                              </p>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                                {statusIcon}
                                {doc.processingStatus}
                              </span>
                              {doc.chunkCount > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {doc.chunkCount} chunks
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {doc.processingStatus !== 'completed' && (
                              <button
                                onClick={() => handleProcess(doc.id)}
                                disabled={!!processingId || isProcessing}
                                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isProcessing
                                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Processing…</>
                                  : <><Play className="h-3 w-3" /> Process</>
                                }
                              </button>
                            )}
                            {doc.processingStatus === 'completed' && (
                              <button
                                onClick={() => handleProcess(doc.id)}
                                disabled={!!processingId}
                                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                              >
                                <RefreshCw className="h-3 w-3" /> Re-process
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={isDeleting || !!processingId}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                            >
                              {isDeleting
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right: Process Log + Search */}
          <div className="space-y-5">

            {/* Processing Log */}
            {(processLog.length > 0 || processingId) && (
              <section className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                  <Loader2 className={`h-4 w-4 text-primary ${processingId ? 'animate-spin' : ''}`} />
                  <h2 className="text-base font-semibold text-foreground">
                    {processDone ? 'Processing Complete' : 'Processing…'}
                  </h2>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto p-4">
                  {processLog.map((log, i) => {
                    const isError = log.step === 'error';
                    const isDone = log.step === 'done';
                    return (
                      <div key={i} className={`rounded-xl px-3 py-2.5 text-xs ${isError ? 'bg-rose-50 text-rose-700' : isDone ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/50 text-foreground'}`}>
                        <p className="font-semibold capitalize">{log.step}</p>
                        <p className="mt-0.5 text-muted-foreground">{log.message}</p>
                        {log.progress != null && (
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${log.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {processingId && !lastLog && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Starting…
                    </div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </section>
            )}

            {/* Semantic Search */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                <Search className="h-4 w-4 text-primary" />
                Semantic Search
              </h2>
              <form onSubmit={handleSearch} className="space-y-3">
                <textarea
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. What is the WHT rate on professional service fees in Uganda?"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
                {searchError && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5" /> {searchError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || searching}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {searching ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </span>
                  ) : 'Search Knowledge Base'}
                </button>
              </form>

              {searchResults !== null && (
                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                    </p>
                    <button
                      onClick={() => { setSearchResults(null); setSearchQuery(''); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                      No matching passages found. Try a different query or ensure documents are processed.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map(result => {
                        const isExpanded = expandedResult === result.id;
                        const preview = result.content?.slice(0, 200) ?? '';
                        const sim = result.similarity != null ? Math.round(result.similarity * 100) : null;

                        return (
                          <div
                            key={result.id}
                            className="overflow-hidden rounded-xl border border-border bg-background"
                          >
                            <button
                              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                              onClick={() => setExpandedResult(isExpanded ? null : result.id)}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground">
                                    Chunk #{result.chunk_index + 1}
                                  </span>
                                  {sim != null && (
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sim >= 70 ? 'bg-emerald-100 text-emerald-700' : sim >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {sim}% match
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                                  {preview}{!isExpanded && result.content.length > 200 ? '…' : ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-muted-foreground">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-border bg-muted/20 px-4 py-3">
                                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                                  {result.content}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
