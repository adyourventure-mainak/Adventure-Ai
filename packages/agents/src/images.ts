import { openai } from "./llm";

// Social post images: generated with OpenAI and stored in a public Supabase
// Storage bucket so the URL is durable (OpenAI's own URLs expire in ~1 hour).
const BUCKET = "social-images";

export function imageStorageConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!.replace(/\/$/, "");
}

async function ensureBucket(): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 409 = already exists — fine.
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    if (!body.includes("already exists")) {
      throw new Error(`Supabase bucket create failed (${res.status}): ${body.slice(0, 200)}`);
    }
  }
}

/**
 * Generate a social-post image and store it durably. Returns the public URL.
 * Callers should treat failures as non-fatal (post ships caption-only).
 */
export async function generateAndStoreImage(params: {
  companyId: string;
  prompt: string;
}): Promise<string> {
  if (!imageStorageConfigured()) {
    throw new Error("Image storage not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }

  const result = await openai().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
    prompt: params.prompt,
    size: "1024x1024",
    n: 1,
    response_format: "b64_json",
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no data");
  const bytes = Buffer.from(b64, "base64");

  await ensureBucket();
  const path = `${params.companyId}/${Date.now()}.png`;
  const upload = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!upload.ok) {
    throw new Error(`Image upload failed (${upload.status}): ${(await upload.text()).slice(0, 200)}`);
  }
  return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${path}`;
}
