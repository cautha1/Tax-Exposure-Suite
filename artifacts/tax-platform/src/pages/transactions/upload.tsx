import React, { useState, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useLocation, Link } from 'wouter';
import Papa from 'papaparse';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ChevronDown,
  X, ArrowLeft, Loader2, Download
} from 'lucide-react';

interface Company {
  id: string;
  companyName: string;
}

interface UploadResult {
  uploadId: string;
  rowsImported: number;
  rowsFailed: number;
  flagsGenerated: number;
  rowErrors?: Array<{ row: number; errors: string[] }>;
}

const REQUIRED_COLS = ['transaction_date', 'description', 'amount', 'currency'];
const OPTIONAL_COLS = [
  'reference', 'account_code', 'account_category', 'vendor_name',
  'customer_name', 'tax_type', 'vat_amount', 'withholding_tax_amount', 'transaction_type',
];
const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS];

const SAMPLE_CSV = [
  ALL_COLS.join(','),
  '2024-01-15,Office supplies purchase,250000,UGX,REF-001,5010,Office Expenses,Acme Ltd,,VAT,45000,,purchase',
  '2024-01-18,Consulting services payment,1500000,UGX,REF-002,6020,Professional Services,Consultant Co,,WHT,,225000,service',
  '2024-01-22,Product sales revenue,3200000,UGX,REF-003,4000,Revenue,,Client Alpha,VAT,576000,,sale',
  '2024-01-25,Staff salaries,4500000,UGX,REF-004,7000,Payroll,,,PAYE,,,payroll',
].join('\n');

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'taxintel_sample_transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionUpload() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const preselectedCompany = searchParams.get('companyId') ?? '';

  const [companyId, setCompanyId] = useState(preselectedCompany);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => api.get<Company[]>('/companies'),
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: { companyId: string; transactions: Record<string, string>[]; fileName: string }) =>
      api.post<UploadResult>('/transactions/upload', payload),
    onSuccess: (data) => {
      setUploadResult(data);
    },
  });

  const parseFile = (f: File) => {
    setFile(f);
    setParseError(null);
    setParsedRows(null);
    setUploadResult(null);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (result) => {
        if (result.errors.length > 0 && result.data.length === 0) {
          setParseError('Failed to parse CSV. Please check the file format.');
          return;
        }
        if (result.data.length === 0) {
          setParseError('The CSV file is empty.');
          return;
        }
        const headers = Object.keys(result.data[0] ?? {});
        const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
        if (missing.length > 0) {
          setParseError(`Missing required columns: ${missing.join(', ')}. Please ensure your CSV has all required headers.`);
          return;
        }
        setParsedRows(result.data as Record<string, string>[]);
      },
      error: (err) => {
        setParseError(`Parse error: ${err.message}`);
      },
    });
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
      parseFile(f);
    } else {
      setParseError('Only CSV files are supported.');
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  };

  const handleUpload = () => {
    if (!companyId) {
      alert('Please select a client company.');
      return;
    }
    if (!parsedRows || parsedRows.length === 0) return;
    uploadMutation.mutate({
      companyId,
      transactions: parsedRows,
      fileName: file?.name ?? 'upload.csv',
    });
  };

  const resetForm = () => {
    setFile(null);
    setParsedRows(null);
    setParseError(null);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewRows = parsedRows?.slice(0, 5) ?? [];
  const previewHeaders = previewRows.length > 0 ? Object.keys(previewRows[0]).filter(h => h.trim()) : [];

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/transactions" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Transactions
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Import Transactions</h1>
          <p className="text-muted-foreground mt-1">Upload a CSV file to analyze Uganda tax exposure and flag potential risks.</p>
        </div>

        {uploadResult ? (
          <div className="space-y-6">
            <div className={`rounded-2xl p-8 border text-center ${uploadResult.rowsImported > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              {uploadResult.rowsImported > 0 ? (
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              ) : (
                <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              )}
              <h2 className="text-2xl font-bold font-display mb-2">
                {uploadResult.rowsImported > 0 ? 'Import Successful' : 'Import Completed with Issues'}
              </h2>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-6">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-3xl font-bold text-emerald-600">{uploadResult.rowsImported}</p>
                  <p className="text-xs text-muted-foreground mt-1">Rows Imported</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-3xl font-bold text-rose-600">{uploadResult.rowsFailed}</p>
                  <p className="text-xs text-muted-foreground mt-1">Rows Failed</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-3xl font-bold text-amber-600">{uploadResult.flagsGenerated}</p>
                  <p className="text-xs text-muted-foreground mt-1">Risks Flagged</p>
                </div>
              </div>
              {uploadResult.flagsGenerated > 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  {uploadResult.flagsGenerated} potential tax risk{uploadResult.flagsGenerated !== 1 ? 's were' : ' was'} automatically detected and flagged for review.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={resetForm} className="px-5 py-2.5 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                Upload Another File
              </button>
              <Link href="/risks" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold shadow-md hover:shadow-lg transition-all">
                Review Risk Flags
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <h3 className="font-semibold text-foreground mb-1">Select Client</h3>
              <p className="text-sm text-muted-foreground mb-3">Transactions will be imported under this client's profile.</p>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              >
                <option value="">— Select a client —</option>
                {companies?.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Upload CSV File</h3>
                  <p className="text-sm text-muted-foreground">Drag and drop your CSV file or click to browse.</p>
                </div>
                <button
                  onClick={downloadSampleCsv}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <FileSpreadsheet className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragOver ? 'text-primary' : 'text-muted-foreground/50'}`} />
                  <p className="text-sm font-medium text-foreground">Drop your CSV file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to select from your computer</p>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileInput} />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                  <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {parseError && (
                <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-700">CSV Parse Error</p>
                    <p className="text-sm text-rose-600 mt-0.5">{parseError}</p>
                  </div>
                </div>
              )}
            </div>

            {parsedRows && parsedRows.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Preview</h3>
                    <p className="text-xs text-muted-foreground">{parsedRows.length} rows detected — showing first 5</p>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">All required columns found</span>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        {previewHeaders.slice(0, 8).map(h => (
                          <th key={h} className={`px-3 py-2 text-left font-semibold border-b border-border text-muted-foreground uppercase tracking-wide ${REQUIRED_COLS.includes(h) ? 'text-primary' : ''}`}>
                            {h.replace(/_/g, ' ')}
                            {REQUIRED_COLS.includes(h) && <span className="ml-1 text-primary">*</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          {previewHeaders.slice(0, 8).map(h => (
                            <td key={h} className="px-3 py-2 text-foreground truncate max-w-[120px]">
                              {row[h] || <span className="text-muted-foreground">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div>
                    <h3 className="font-semibold text-foreground">CSV Format Guide</h3>
                    <p className="text-xs text-muted-foreground">Learn about required and optional columns</p>
                  </div>
                  <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Required Columns <span className="text-rose-500">*</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {REQUIRED_COLS.map(c => (
                        <div key={c} className="p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                          <p className="font-mono text-xs font-bold text-rose-700">{c}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{
                            c === 'transaction_date' ? 'YYYY-MM-DD format' :
                            c === 'amount' ? 'Numeric value in currency' :
                            c === 'currency' ? 'e.g. UGX, USD' :
                            c === 'description' ? 'Transaction description' : ''
                          }</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Optional Columns</p>
                    <div className="grid grid-cols-3 gap-2">
                      {OPTIONAL_COLS.map(c => (
                        <div key={c} className="p-2 rounded-lg bg-muted/30 border border-border/50">
                          <p className="font-mono text-xs text-muted-foreground">{c}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-xs font-semibold text-primary mb-1">Tax Type Values</p>
                    <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">VAT</code>, <code className="bg-muted px-1 rounded">WHT</code>, or <code className="bg-muted px-1 rounded">PAYE</code> in the <code className="bg-muted px-1 rounded">tax_type</code> column. The system will automatically flag missing VAT (18%), WHT (15%), and PAYE (30%) amounts.</p>
                  </div>
                </div>
              </details>
            </div>

            <div className="flex gap-4 justify-end">
              <Link href="/transactions" className="px-5 py-2.5 border border-border rounded-xl font-medium text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </Link>
              <button
                onClick={handleUpload}
                disabled={!parsedRows || parsedRows.length === 0 || !companyId || uploadMutation.isPending}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
              >
                {uploadMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="w-5 h-5" /> Import {parsedRows ? `${parsedRows.length} Rows` : 'Transactions'}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
