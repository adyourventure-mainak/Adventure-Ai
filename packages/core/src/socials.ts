/**
 * Build a social profile URL from whatever the owner typed — a bare handle
 * ("chaikarigar", "@chaikarigar") or a pasted full URL. Returns null when the
 * input can't be turned into a link on the right platform.
 */

export type SocialPlatform = "facebook" | "instagram" | "youtube";

const HOSTS: Record<SocialPlatform, string[]> = {
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
};

// Handles: letters, digits, dot, underscore, hyphen (covers all three platforms).
const HANDLE_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function socialProfileUrl(raw: string | undefined | null, platform: SocialPlatform): string | null {
  if (!raw || !raw.trim()) return null;
  const v = raw.trim();
  const hosts = HOSTS[platform];

  // Pasted URL (or something URL-ish like "www.instagram.com/x" / "instagram.com/x").
  if (/^https?:\/\//i.test(v) || /^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) {
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withProto);
      const host = u.hostname.replace(/^www\.|^m\./, "");
      return hosts.some((h) => host === h || host.endsWith(`.${h}`)) ? u.toString() : null;
    } catch {
      return null;
    }
  }

  // Bare handle / account name.
  const handle = v.replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return null;
  switch (platform) {
    case "facebook":
      return `https://facebook.com/${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "youtube":
      return `https://youtube.com/@${handle}`;
  }
}
