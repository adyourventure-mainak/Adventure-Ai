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

  // No response_format param — newer image models reject it. Handle both
  // shapes: b64_json (gpt-image-1 default) and a temporary URL (dall-e-3).
  const result = await openai().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    prompt: params.prompt,
    size: "1024x1024",
    n: 1,
  });
  const datum = result.data?.[0];
  let bytes: Buffer;
  if (datum?.b64_json) {
    bytes = Buffer.from(datum.b64_json, "base64");
  } else if (datum?.url) {
    const res = await fetch(datum.url);
    if (!res.ok) throw new Error(`Image download failed (${res.status})`);
    bytes = Buffer.from(await res.arrayBuffer());
  } else {
    throw new Error("Image generation returned no data");
  }

  // sharp is a native module and only the worker generates images — load it
  // lazily so importing @adventure/agents never breaks bundled (Vercel) code.
  const sharp = (await import("sharp")).default;

  // Deliverable spec: square 1:1, ~100 KB, downloadable. Re-encode as JPEG,
  // stepping quality down until it fits the budget.
  let size = 1024;
  let quality = 82;
  let jpeg = await sharp(bytes).resize(size, size, { fit: "cover" }).jpeg({ quality }).toBuffer();
  while (jpeg.length > 110 * 1024 && quality > 45) {
    quality -= 10;
    jpeg = await sharp(bytes).resize(size, size, { fit: "cover" }).jpeg({ quality }).toBuffer();
  }
  if (jpeg.length > 110 * 1024) {
    // Still over budget (busy/noisy image) — step the dimensions down instead
    // of the quality, which looks better than sub-45 JPEG artifacts.
    for (size of [800, 640, 512]) {
      jpeg = await sharp(bytes).resize(size, size, { fit: "cover" }).jpeg({ quality: 70 }).toBuffer();
      if (jpeg.length <= 110 * 1024) break;
    }
  }
  bytes = jpeg;

  await ensureBucket();
  const path = `${params.companyId}/${Date.now()}.jpg`;
  const upload = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });
  if (!upload.ok) {
    throw new Error(`Image upload failed (${upload.status}): ${(await upload.text()).slice(0, 200)}`);
  }
  return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${path}`;
}
