import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

const Input = z.object({
  facebookUrl: z.string().max(300).optional().or(z.literal("")),
  instagramUrl: z.string().max(300).optional().or(z.literal("")),
});

function normalizeProfile(raw: string | undefined, host: "facebook.com" | "instagram.com"): string | null {
  if (!raw || !raw.trim()) return null;
  let v = raw.trim();
  if (!/^https?:\/\//i.test(v)) v = `https://${v.replace(/^@/, `${host}/`)}`;
  try {
    const u = new URL(v);
    if (!u.hostname.replace(/^www\./, "").endsWith(host)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Save the company's Facebook/Instagram profiles (used by the Social agent). */
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const facebookUrl = normalizeProfile(parsed.data.facebookUrl, "facebook.com");
  const instagramUrl = normalizeProfile(parsed.data.instagramUrl, "instagram.com");
  if (parsed.data.facebookUrl?.trim() && !facebookUrl) {
    return NextResponse.json({ error: "That doesn't look like a facebook.com profile URL." }, { status: 400 });
  }
  if (parsed.data.instagramUrl?.trim() && !instagramUrl) {
    return NextResponse.json({ error: "That doesn't look like an instagram.com profile URL." }, { status: 400 });
  }

  await prisma.company.update({
    where: { id: company.id },
    data: { facebookUrl, instagramUrl },
  });
  return NextResponse.json({ ok: true, facebookUrl, instagramUrl });
}
