import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { AppLayout } from '@/components/layout';
import { useListCompanies, useUploadTransactions } from '@workspace/api-client-react';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

const REQUIRED_HEADERS = [
  'transaction_date', 'description', 'reference', 'amount', 
  'currency', 'account_code', 'tax_type'
];

export default function Upload() {
  const [, setLocation] = useLocation();
  const [selectedCompany, setSelectedCompany] = useState('');
  const { data: companies } = useListCompanies();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  
  const uploadMutation = useUploadTransactions({
    mutation: {
      onSuccess: () => {
        setLocation('/transactions');
      }
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (f) {
      setFile(f);
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
          
          if (missing.length > 0) {
            setErrors([`Missing required headers: ${missing.join(', ')}`]);
            setParsedData([]);
          } else {
            setErrors([]);
            setParsedData(results.data);
          }
        },
        error: (error) => {
          setErrors([`Failed to parse CSV: ${error.message}`]);
        }
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1
  });

  const handleUpload = () => {
    if (!selectedCompany || parsedData.length === 0) return;
    
    uploadMutation.mutate({
      data: {
        companyId: selectedCompany,
        fileName: file!.name,
        transactions: parsedData
      }
    });
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <Link href="/transactions" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Transactions
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Import Transactions</h1>
          <p className="text-muted-foreground mt-1">Upload ERP extracts to analyze for tax risks.</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
          <div className="max-w-xl mb-8">
            <label className="block text-sm font-medium mb-2 text-foreground">Select Client Workspace</label>
            <select 
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="">-- Choose Client --</option>
              {companies?.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>

          <div 
            {...getRootProps()} 
            className={`
              border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
              ${file && errors.length === 0 ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            {file && errors.length === 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{file.name}</h3>
                <p className="text-muted-foreground mt-2">{parsedData.length} rows ready for analysis</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Drag & drop your CSV file</h3>
                <p className="text-muted-foreground mt-2">or click to browse from your computer</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md">
                  {REQUIRED_HEADERS.map(h => (
                    <span key={h} className="text-[10px] font-mono bg-muted px-2 py-1 rounded text-muted-foreground">{h}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="mt-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Validation Errors</h4>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-border">
            <button 
              onClick={() => { setFile(null); setParsedData([]); setErrors([]); }}
              className="px-6 py-3 rounded-xl font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Reset
            </button>
            <button 
              onClick={handleUpload}
              disabled={!selectedCompany || parsedData.length === 0 || uploadMutation.isPending}
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none flex items-center gap-2"
            >
              {uploadMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
              Start Analysis
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
