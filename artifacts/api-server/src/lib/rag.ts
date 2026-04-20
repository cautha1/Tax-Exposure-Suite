import OpenAI from "openai";

const OPENAI_API_KEY = process.env["OPENAI_API_KEY"] ?? "";
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((current + " " + trimmed).trim().split(/\s+/).length <= CHUNK_SIZE) {
      current = current ? current + "\n\n" + trimmed : trimmed;
    } else {
      if (current) chunks.push(current.trim());
      const words = trimmed.split(/\s+/);
      if (words.length > CHUNK_SIZE) {
        for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          const slice = words.slice(i, i + CHUNK_SIZE).join(" ");
          if (slice.trim()) chunks.push(slice.trim());
        }
        current = "";
      } else {
        current = trimmed;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 30);
}

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  const BATCH = 100;
  const results: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    const sorted = response.data.sort((a, b) => a.index - b.index);
    results.push(...sorted.map(d => d.embedding));
    if (i + BATCH < chunks.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return results;
}

export async function embedQuery(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: [query],
  });
  return response.data[0]!.embedding;
}
