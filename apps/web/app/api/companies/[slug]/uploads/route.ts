import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

export const maxDuration = 60;

// Owner image uploads for the company website (design brief / engineer edits).
// Stored in a public Supabase Storage bucket; the returned URLs go into the
// design brief (Company.theme.imageUrls) or an Engineer task payload.
const BUCKET = "site-assets";
const MAX_FILES = 5;
const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless request body cap is ~4.5 MB

// Raster images only. Never trust the client's file.type — SVG (scriptable) and
// anything else is rejected by sniffing the actual bytes, and the stored
// content type comes from the sniff, not the request.
const MAGIC: [string, (b: Uint8Array) => boolean][] = [
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ["image/gif", (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38],
  [
    "image/webp",
    (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  ],
];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  for (const [mime, test] of MAGIC) if (test(bytes)) return mime;
  return null;
}

function storageConfigured() {
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
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    if (!body.includes("already exists")) {
      throw new Error(`Bucket create failed (${res.status}): ${body.slice(0, 200)}`);
    }
  }
}

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "Image uploads are not configured yet — please try again later." },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  const files = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (files.length === 0) return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Upload at most ${MAX_FILES} images` }, { status: 400 });
  }

  await ensureBucket();
  const urls: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `"${file.name}" is over 4 MB — please use a smaller image` }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageType(bytes);
    if (!mime) {
      return NextResponse.json(
        { error: `"${file.name}" is not a supported image — use JPEG, PNG, WebP, or GIF` },
        { status: 400 },
      );
    }
    const path = `${company.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[mime]}`;
    const upload = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        "Content-Type": mime,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!upload.ok) {
      return NextResponse.json(
        { error: `Upload failed (${upload.status}) — please retry` },
        { status: 502 },
      );
    }
    urls.push(`${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${path}`);
  }

  return NextResponse.json({ urls });
}
