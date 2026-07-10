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
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `"${file.name}" is not an image` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `"${file.name}" is over 4 MB — please use a smaller image` }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${company.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const upload = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: new Uint8Array(await file.arrayBuffer()),
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
