import { Router, type IRouter } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";
import { chunkText, embedChunks, embedQuery } from "../lib/rag.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

interface DocRow {
  id: string;
  title: string | null;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  source_type: string | null;
  jurisdiction: string | null;
  document_category: string | null;
  version_label: string | null;
  processing_status: string | null;
  extracted_text: string | null;
  chunk_count: number | null;
  metadata: Record<string, unknown> | null;
  uploaded_at: string;
}

function fmtDoc(d: DocRow) {
  return {
    id: d.id,
    title: d.title ?? d.file_name ?? null,
    fileName: d.file_name ?? null,
    storageBucket: d.storage_bucket ?? null,
    storagePath: d.storage_path ?? null,
    sourceType: d.source_type ?? "pdf",
    jurisdiction: d.jurisdiction ?? null,
    documentCategory: d.document_category ?? null,
    versionLabel: d.version_label ?? null,
    processingStatus: d.processing_status ?? "pending",
    extractedText: d.extracted_text ?? null,
    chunkCount: d.chunk_count ?? 0,
    metadata: d.metadata ?? {},
    uploadedAt: d.uploaded_at,
  };
}

const BUCKET = "Uganda Tax Law";

router.get("/rag/documents", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tax_source_documents")
      .select("*")
      .order("uploaded_at", { ascending: false });
    sbErr(error, "list documents");
    res.json((data ?? []).map(fmtDoc));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/rag/documents/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tax_source_documents")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error || !data) { res.status(404).json({ error: "Document not found" }); return; }
    res.json(fmtDoc(data as DocRow));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/rag/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "PDF file is required" }); return; }
    if (file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "Only PDF files are supported" });
      return;
    }

    const { title, jurisdiction = "Uganda", documentCategory = "tax_law", versionLabel } = req.body as Record<string, string>;
    const fileName = file.originalname;
    const storagePath = `${Date.now()}-${fileName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr && !upErr.message.includes("already exists")) {
      sbErr(upErr, "upload to storage");
    }

    const { data: docData, error: docErr } = await supabase
      .from("tax_source_documents")
      .insert({
        title: title || fileName,
        file_name: fileName,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        source_type: "pdf",
        jurisdiction,
        document_category: documentCategory,
        version_label: versionLabel || null,
        processing_status: "pending",
        chunk_count: 0,
        metadata: { size: file.size, mimetype: file.mimetype },
      })
      .select()
      .single();
    sbErr(docErr, "insert document record");

    res.json({
      document: fmtDoc(docData as DocRow),
      message: "Document uploaded. Use /api/rag/process/:id to extract and embed.",
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/rag/process/:id", async (req, res) => {
  const { id } = req.params;

  const { data: docRaw, error: docErr } = await supabase
    .from("tax_source_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (docErr || !docRaw) { res.status(404).json({ error: "Document not found" }); return; }
  const doc = docRaw as DocRow;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: Record<string, unknown>) =>
    res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    await supabase.from("tax_source_documents")
      .update({ processing_status: "extracting" })
      .eq("id", id);
    send({ step: "extracting", message: "Downloading PDF from storage…" });

    const { data: fileData, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(doc.storage_path ?? "");
    if (dlErr) throw new Error(`Storage download failed: ${dlErr.message}`);

    const buffer = Buffer.from(await (fileData as Blob).arrayBuffer());
    send({ step: "extracting", message: "Parsing PDF text…" });

    const pdf = await pdfParse(buffer);
    const rawText = pdf.text;
    const pageCount = pdf.numpages;

    send({ step: "chunking", message: `Extracted ${rawText.length.toLocaleString()} characters from ${pageCount} pages. Splitting into chunks…` });

    const chunks = chunkText(rawText);
    send({ step: "chunking", message: `Created ${chunks.length} chunks. Generating embeddings…`, chunkCount: chunks.length });

    await supabase.from("tax_source_documents")
      .update({ processing_status: "embedding", extracted_text: rawText.slice(0, 50000) })
      .eq("id", id);

    const EMBED_BATCH = 50;
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const batchEmbeddings = await embedChunks(batch);
      embeddings.push(...batchEmbeddings);
      send({
        step: "embedding",
        message: `Embedded ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length} chunks…`,
        progress: Math.round((Math.min(i + EMBED_BATCH, chunks.length) / chunks.length) * 100),
      });
    }

    await supabase.from("tax_source_documents")
      .update({ processing_status: "saving" })
      .eq("id", id);
    send({ step: "saving", message: "Saving chunks to database…" });

    await supabase.from("tax_document_chunks").delete().eq("document_id", id);

    const SAVE_BATCH = 20;
    for (let i = 0; i < chunks.length; i += SAVE_BATCH) {
      const rows = chunks.slice(i, i + SAVE_BATCH).map((content, j) => ({
        document_id: id,
        chunk_index: i + j,
        content,
        embedding: JSON.stringify(embeddings[i + j]),
        token_count: Math.ceil(content.split(/\s+/).length * 1.3),
        page_number: null,
        section_title: null,
        metadata: { source: doc.file_name, chunkIndex: i + j },
      }));
      const { error: chunkErr } = await supabase.from("tax_document_chunks").insert(rows);
      if (chunkErr) throw new Error(`Chunk insert failed: ${chunkErr.message}`);
    }

    await supabase.from("tax_source_documents")
      .update({
        processing_status: "completed",
        chunk_count: chunks.length,
      })
      .eq("id", id);

    send({
      step: "done",
      message: `Processing complete! ${chunks.length} chunks stored with embeddings.`,
      chunkCount: chunks.length,
      pageCount,
      characterCount: rawText.length,
    });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error(err);
    await supabase.from("tax_source_documents")
      .update({ processing_status: "failed" })
      .eq("id", id);
    send({ step: "error", message: msg });
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

router.post("/rag/search", async (req, res) => {
  try {
    const { query, limit = 8, documentId } = req.body as { query: string; limit?: number; documentId?: string };
    if (!query || query.trim().length < 3) {
      res.status(400).json({ error: "Query must be at least 3 characters" });
      return;
    }

    const embedding = await embedQuery(query);

    let rpcParams: Record<string, unknown> = {
      query_embedding: JSON.stringify(embedding),
      match_count: limit,
      similarity_threshold: 0.3,
    };
    if (documentId) rpcParams["filter_document_id"] = documentId;

    const { data, error } = await supabase.rpc("match_tax_document_chunks", rpcParams);

    let chunks = data ?? [];

    if (error || !data || data.length === 0) {
      let q = supabase.from("tax_document_chunks")
        .select("id, document_id, chunk_index, content, section_title, metadata")
        .limit(Number(limit));
      if (documentId) q = q.eq("document_id", documentId);
      const { data: fallbackData } = await q;
      chunks = (fallbackData ?? []).map((c: Record<string, unknown>) => ({ ...c, similarity: 0.5 }));
    }

    const logEntry: Record<string, unknown> = {
      query_text: query,
      user_id: req.headers["x-user-id"] || null,
      retrieved_chunk_ids: (chunks as Array<{ id?: string }>).map((c) => c.id).filter(Boolean),
      metadata: { limit, documentId: documentId || null },
    };
    await supabase.from("tax_rag_query_logs").insert(logEntry);

    res.json({ query, results: chunks, count: chunks.length });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/rag/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: doc } = await supabase.from("tax_source_documents").select("storage_path").eq("id", id).single();
    if (doc?.storage_path) {
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    }
    await supabase.from("tax_document_chunks").delete().eq("document_id", id);
    await supabase.from("tax_source_documents").delete().eq("id", id);
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/rag/process-existing/:id", async (req, res) => {
  res.json({ message: "Use /api/rag/process/:id for SSE streaming progress." });
});

export default router;
