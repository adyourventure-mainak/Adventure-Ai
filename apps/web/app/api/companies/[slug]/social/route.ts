import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { socialProfileUrl } from "@adventure/core";
import { getUser } from "@/lib/auth";

const Input = z.object({
  facebookUrl: z.string().max(300).optional().or(z.literal("")),
  instagramUrl: z.string().max(300).optional().or(z.literal("")),
  youtubeUrl: z.string().max(300).optional().or(z.literal("")),
});

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

  const facebookUrl = socialProfileUrl(parsed.data.facebookUrl, "facebook");
  const instagramUrl = socialProfileUrl(parsed.data.instagramUrl, "instagram");
  const youtubeUrl = socialProfileUrl(parsed.data.youtubeUrl, "youtube");
  if (parsed.data.facebookUrl?.trim() && !facebookUrl) {
    return NextResponse.json({ error: "That doesn't look like a Facebook account name or URL." }, { status: 400 });
  }
  if (parsed.data.instagramUrl?.trim() && !instagramUrl) {
    return NextResponse.json({ error: "That doesn't look like an Instagram account name or URL." }, { status: 400 });
  }
  if (parsed.data.youtubeUrl?.trim() && !youtubeUrl) {
    return NextResponse.json({ error: "That doesn't look like a YouTube account name or URL." }, { status: 400 });
  }

  // DPDP: the owner submitting their own links is the consent act — stamp it;
  // clearing every link withdraws it.
  const hasSocials = Boolean(facebookUrl || instagramUrl || youtubeUrl);
  await prisma.company.update({
    where: { id: company.id },
    data: { facebookUrl, instagramUrl, youtubeUrl, socialConsentAt: hasSocials ? new Date() : null },
  });
  return NextResponse.json({ ok: true, facebookUrl, instagramUrl, youtubeUrl });
}
