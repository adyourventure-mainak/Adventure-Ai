import type { CompanyTheme, LandingCopy } from "@adventure/core";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PLATFORM_URL = "https://www.adventure-ai.in";

export interface SitePage {
  path: string;
  content: string;
}

export interface SiteParams {
  companyId: string;
  companyName: string;
  tagline?: string | null;
  ideaSummary?: string | null;
  positioning?: string | null;
  phone?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  linkedinUrl?: string | null;
  theme?: CompanyTheme | null;
  copy: LandingCopy;
  gmbUrl?: string | null;
  reviews?: { author: string; rating: number; text: string }[] | null;
}

const DEFAULT_ACCENT = "#fb7f14";
const DEFAULT_ACCENT_DARK = "#c2610a";

const hex = (v: string | undefined, fallback: string) =>
  v && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;

const FONT_STACK: Record<NonNullable<CompanyTheme["fontFamily"]>, string> = {
  sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  serif: `Georgia, "Iowan Old Style", "Times New Roman", serif`,
  rounded: `ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`,
  mono: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
};

/** Per-style tweaks layered on top of the base CSS. Each style should read as
 *  a genuinely different site — header, hero, cards, and footer all change. */
const STYLE_CSS: Record<NonNullable<CompanyTheme["style"]>, string> = {
  // Airy, centered, quiet — whitespace, thin accent rules, ghost header.
  minimal: `
  .hero { padding: 136px 0 96px; }
  .hero h1 { font-weight: 500; }
  .hero p { font-size: 18px; }
  header { border-bottom: none; padding: 28px 0; }
  .logo { font-weight: 500; letter-spacing: .04em; }
  .cta { background: var(--ink); border-radius: 0; padding: 14px 40px; }
  .cta:hover { background: var(--accent); }
  .cta-secondary { color: var(--ink); border-color: var(--ink); }
  .features { gap: 48px; padding: 64px 0 96px; }
  .features div { border-top: 2px solid var(--accent); padding-top: 20px; }
  .card { border: none; border-left: 2px solid var(--accent); border-radius: 0; background: #fafafa; }
  .hero-img, .gallery img { border-radius: 0; box-shadow: none; }
  footer { border-top: none; }`,
  // Loud type, uppercase nav, accent hero wash, chunky tinted panels.
  bold: `
  .hero { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, #fff), #fff 70%); margin: 0 -24px; padding: 104px 24px 80px; }
  .hero h1 { font-size: 58px; font-weight: 800; letter-spacing: -0.02em; text-transform: uppercase; }
  nav a { text-transform: uppercase; letter-spacing: .06em; font-size: 13px; font-weight: 700; }
  .logo { font-size: 24px; font-weight: 900; text-transform: uppercase; }
  .cta { font-size: 18px; padding: 16px 44px; border-radius: 0; box-shadow: 4px 4px 0 var(--ink); }
  .cta:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--ink); }
  header { border-bottom: 4px solid var(--accent); }
  .features div { background: color-mix(in srgb, var(--accent) 9%, #fff); padding: 28px; border-radius: var(--radius); border: 2px solid var(--ink); }
  .features h3 { color: var(--accent-dark); text-transform: uppercase; font-size: 16px; }
  .card { border: 2px solid var(--ink); }
  footer { background: var(--ink); color: #ccc; } footer a { color: #fff; }`,
  // Round everything, soft tinted background blobs, tilted imagery, bouncy hover.
  playful: `
  :root { --radius: 22px; }
  body { background: color-mix(in srgb, var(--accent) 4%, #fff); }
  .cta, .card, input, textarea, button, .features div { border-radius: 22px !important; }
  .hero { background: color-mix(in srgb, var(--accent) 11%, #fff); margin: 24px 0 0; border-radius: 32px; padding: 88px 24px 72px; }
  .hero h1 { font-size: 46px; }
  .cta { box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 40%, transparent); }
  .cta:hover { transform: translateY(-2px) scale(1.02); }
  .hero-img, .gallery img { border-radius: 22px; transform: rotate(-1.5deg); }
  .gallery img:nth-child(even) { transform: rotate(1.5deg); }
  .features div { background: #fff; padding: 26px; transition: transform .2s; box-shadow: 0 4px 16px rgba(0,0,0,.06); }
  .features div:hover { transform: translateY(-4px) rotate(.5deg); }
  .card { background: #fff; border: none; box-shadow: 0 4px 16px rgba(0,0,0,.06); }
  header { border-bottom: 0; }
  .logo { color: var(--accent-dark); }`,
  // Refined and understated: hairlines, small-caps nav, outlined CTA, serif accents.
  elegant: `
  body { letter-spacing: .005em; }
  .hero { padding: 128px 0 88px; }
  .hero h1 { font-weight: 600; font-size: 40px; letter-spacing: .01em; }
  .hero h1::after { content: ""; display: block; width: 56px; height: 1px; background: var(--accent-dark); margin: 28px auto 0; }
  .hero-split h1::after { margin-left: 0; }
  nav a { font-variant: small-caps; letter-spacing: .12em; font-size: 14px; }
  .logo { font-weight: 600; letter-spacing: .08em; }
  header { padding: 26px 0; border-bottom: 1px solid #e8e8e8; }
  .cta { background: transparent; color: var(--accent-dark); border: 1px solid var(--accent-dark); border-radius: 0; letter-spacing: .08em; text-transform: uppercase; font-size: 14px; }
  .cta:hover { background: var(--accent-dark); color: #fff; }
  .features { border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5; padding: 56px 0; gap: 40px; }
  .features h3 { font-weight: 600; letter-spacing: .04em; }
  .card { border-radius: 0; border-color: #e5e5e5; }
  .hero-img, .gallery img { border-radius: 2px; box-shadow: 0 12px 40px rgba(0,0,0,.1); }
  footer { letter-spacing: .04em; }`,
  // Squared, structured, dark header, boxed feature grid — business-like.
  corporate: `
  :root { --radius: 4px; }
  .cta, .card, input, textarea, button { border-radius: 4px !important; }
  .hero { text-align: left; padding: 88px 0 64px; border-bottom: 1px solid #e5e5e5; }
  .hero h1, .hero p { margin-left: 0; }
  header { background: var(--ink); border-bottom: none; }
  header .logo, header nav a { color: #fff; }
  header nav a.active, header nav a:hover { color: var(--accent); }
  .hero h1 { position: relative; padding-top: 20px; }
  .hero h1::before { content: ""; position: absolute; top: 0; left: 0; width: 48px; height: 4px; background: var(--accent); }
  .features { gap: 0; border: 1px solid #e5e5e5; }
  .features div { border-right: 1px solid #e5e5e5; padding: 28px; margin: 0; }
  .features div:last-child { border-right: 0; }
  .hero-img { margin-left: 0; }
  .card { background: #fafafa; }
  footer { background: #f5f5f6; border-top: 1px solid #e5e5e5; }`,
};

/** Small deterministic hash so the same company always gets the same variant. */
function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Per-company layout variation layered on top of the style, seeded from
 *  companyId — two companies with the same style still get visibly different
 *  hero alignment, feature treatment, and section rhythm. */
function variantCss(seed: number): string {
  const heroAlign = [
    "", // centered (default)
    `.hero:not(.hero-split) { text-align: left; } .hero:not(.hero-split) h1, .hero:not(.hero-split) p { margin-left: 0; }`,
  ][seed % 2];
  const featureShape = [
    "",
    `.features { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); } .features div { text-align: center; }`,
    `.features h3::before { content: "— "; color: var(--accent); }`,
  ][(seed >> 2) % 3];
  const rhythm = [
    "",
    `.faq { max-width: 640px; } .faq h2 { text-align: left; }`,
  ][(seed >> 4) % 2];
  return `${heroAlign}\n${featureShape}\n${rhythm}`;
}

function css(theme?: CompanyTheme | null): string {
  const accent = hex(theme?.accentColor, DEFAULT_ACCENT);
  const accentDark = hex(theme?.accentDarkColor, DEFAULT_ACCENT_DARK);
  const font = FONT_STACK[theme?.fontFamily ?? "sans"] ?? FONT_STACK.sans;
  const styleCss = STYLE_CSS[theme?.style ?? "minimal"] ?? "";
  return `
  :root { --accent: ${accent}; --accent-dark: ${accentDark}; --ink: #161619; --muted: #4c4e57; --radius: 10px; }
  * { margin: 0; box-sizing: border-box; }
  html { color-scheme: light; }
  body { font-family: ${font}; color: var(--ink); background: #fff; line-height: 1.6; }`;
}

// Layout rules shared by all themes; colors/fonts come from css(theme) above.
const CSS = `
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }
  header { padding: 20px 0; border-bottom: 1px solid #eee; }
  header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .logo { font-weight: 700; font-size: 20px; color: var(--ink); text-decoration: none; }
  nav { display: flex; gap: 20px; flex-wrap: wrap; }
  nav a { color: var(--muted); text-decoration: none; font-size: 15px; }
  nav a:hover, nav a.active { color: var(--accent); }
  .hero { text-align: center; padding: 96px 0 72px; }
  .hero h1 { font-size: 44px; line-height: 1.15; max-width: 720px; margin: 0 auto; }
  .hero p { font-size: 20px; color: var(--muted); max-width: 560px; margin: 20px auto 0; }
  .cta { display: inline-block; margin-top: 32px; background: var(--accent); color: #fff; padding: 14px 32px; border-radius: var(--radius); font-weight: 600; text-decoration: none; }
  .cta:hover { background: var(--accent-dark); }
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px; padding: 48px 0 72px; }
  .features h3 { margin-bottom: 8px; }
  .features p { color: var(--muted); font-size: 15px; }
  .page { padding: 64px 0 96px; max-width: 720px; margin: 0 auto; }
  .page h1 { font-size: 34px; margin-bottom: 24px; }
  .page h2 { font-size: 22px; margin: 32px 0 12px; }
  .page p { color: var(--muted); margin-bottom: 16px; }
  .card { border: 1px solid #eee; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .card h3 { margin-bottom: 8px; }
  .card p { color: var(--muted); font-size: 15px; margin: 0; }
  .reviews { padding: 0 0 80px; }
  .reviews h2 { text-align: center; margin-bottom: 32px; }
  .reviews-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .reviews blockquote { margin: 0; }
  .reviews .stars { color: #f5a623; letter-spacing: 2px; font-size: 15px; }
  .reviews p { color: var(--muted); font-size: 15px; margin: 10px 0 12px; }
  .reviews cite { font-style: normal; font-weight: 600; font-size: 14px; }
  .reviews-more { text-align: center; margin-top: 24px; font-size: 14px; }
  .reviews-more a { color: var(--accent-dark); }
  .faq { padding: 0 0 96px; max-width: 720px; margin: 0 auto; }
  .faq h2 { text-align: center; margin-bottom: 32px; }
  .faq details { border-bottom: 1px solid #eee; padding: 16px 0; }
  .faq summary { font-weight: 600; cursor: pointer; }
  .faq p { color: var(--muted); margin-top: 8px; }
  form { display: grid; gap: 14px; }
  label { font-weight: 600; font-size: 14px; }
  input, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: var(--radius); font: inherit; }
  button { background: var(--accent); color: #fff; border: 0; padding: 14px 32px; border-radius: var(--radius); font-weight: 600; font-size: 16px; cursor: pointer; }
  button:hover:not(:disabled) { background: var(--accent-dark); }
  button:disabled { opacity: .6; cursor: default; }
  .hero-split { display: grid; grid-template-columns: 1.1fr 1fr; gap: 48px; align-items: center; text-align: left; padding: 80px 0 64px; }
  .hero-split h1, .hero-split p { margin-left: 0; margin-right: 0; max-width: none; }
  .hero-split .hero-img { margin: 0; max-width: 100%; }
  @media (max-width: 760px) { .hero-split { grid-template-columns: 1fr; text-align: center; } }
  .cta-secondary { background: transparent; color: var(--accent); border: 2px solid var(--accent); margin-left: 12px; }
  .cta-secondary:hover { background: var(--accent); color: #fff; }
  .call-btn { background: var(--accent); color: #fff !important; padding: 8px 16px; border-radius: 999px; font-weight: 600; font-size: 14px; text-decoration: none; }
  .call-btn:hover { background: var(--accent-dark); }
  .socials { margin-bottom: 8px; } .socials a { font-weight: 600; }
  .hero-img { display: block; max-width: 860px; width: 100%; margin: 40px auto 0; border-radius: var(--radius); box-shadow: 0 20px 50px rgba(0,0,0,.12); }
  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; padding: 24px 0 48px; }
  .gallery img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius); }
  .form-note { font-size: 14px; }
  .form-note.ok { color: #15803d; }
  .form-note.err { color: #b91c1c; }
  footer { text-align: center; color: var(--muted); font-size: 13px; padding: 32px 0; border-top: 1px solid #eee; }
  footer a { color: var(--muted); }
  .wa-float { position: fixed; right: 20px; bottom: 20px; z-index: 50; display: inline-flex; align-items: center; gap: 8px; background: #25d366; color: #fff; padding: 12px 18px; border-radius: 999px; font-weight: 600; text-decoration: none; box-shadow: 0 6px 20px rgba(0,0,0,.18); }
  .wa-float:hover { background: #1da851; }
  .wa-float svg { width: 22px; height: 22px; fill: #fff; }
  @media (max-width: 520px) { .wa-float span { display: none; } .wa-float { padding: 14px; } }
`;

const WA_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.599 5.393l-.999 3.648 3.9-1.14zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;

/** Digits-only phone for wa.me links; null if too short to be usable. */
function waNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function shell(params: {
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  active: "index" | "about" | "services" | "contact";
  body: string;
  theme?: CompanyTheme | null;
  phone?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  linkedinUrl?: string | null;
}): string {
  const nav = (
    [
      ["index.html", "Home", "index"],
      ["about.html", "About", "about"],
      ["services.html", "Services", "services"],
      ["contact.html", "Contact", "contact"],
    ] as const
  )
    .map(
      ([href, label, key]) =>
        `<a href="${href}"${key === params.active ? ' class="active"' : ""}>${label}</a>`,
    )
    .join("");

  const wa = waNumber(params.phone);
  const waText = encodeURIComponent(`Hi ${params.companyName}, I found you through your website.`);
  const waLink = wa ? `https://wa.me/${wa}?text=${waText}` : null;
  const waButton = waLink
    ? `<a class="wa-float" href="${waLink}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${WA_ICON}<span>Chat with us</span></a>`
    : "";

  const styleCss = STYLE_CSS[params.theme?.style ?? "minimal"] ?? "";
  const variant = variantCss(seedFrom(params.companyId));
  const socials = [
    params.facebookUrl ? `<a href="${esc(params.facebookUrl)}" target="_blank" rel="noopener">Facebook</a>` : "",
    params.instagramUrl ? `<a href="${esc(params.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : "",
    params.youtubeUrl ? `<a href="${esc(params.youtubeUrl)}" target="_blank" rel="noopener">YouTube</a>` : "",
    params.linkedinUrl ? `<a href="${esc(params.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn</a>` : "",
  ].filter(Boolean).join(" · ");
  // Header contact button opens a WhatsApp chat with the company's number.
  const callNav = waLink
    ? `<a class="call-btn" href="${waLink}" target="_blank" rel="noopener">📞 Call now</a>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(params.title)}</title>
<meta name="description" content="${esc(params.description)}" />
<style>${css(params.theme)}${CSS}${styleCss}${variant}</style>
</head>
<body>
<header><div class="wrap"><a class="logo" href="index.html">${esc(params.companyName)}</a><nav>${nav}${callNav}</nav></div></header>
<main class="wrap">
${params.body}
</main>
<footer>${socials ? `<p class="socials">${socials}</p>` : ""}© ${new Date().getFullYear()} ${esc(params.companyName)} · Built and operated by <a href="${PLATFORM_URL}">Adventure AI</a></footer>
${waButton}
</body>
</html>
`;
}

/**
 * Deterministic multi-page site renderer: company foundation + LandingPage.copy
 * JSON → static HTML pages (home, about, services, contact). The Engineer
 * agent edits the copy JSON with the LLM; this template turns it into the
 * deployable site, so deploys stay reproducible and reviewable. The contact
 * form posts leads back to the platform, which routes them to the company's
 * Support agent.
 */
export function renderSite(params: SiteParams): SitePage[] {
  const { companyName, copy } = params;
  // Owner-uploaded images (design brief): first one leads the hero, the rest
  // form a gallery. URLs are attribute-escaped like all other interpolations.
  const images = (params.theme?.imageUrls ?? []).filter((u) => /^https:\/\//.test(u)).slice(0, 5);
  const tel = waNumber(params.phone);
  const waHref = tel
    ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hi ${companyName}, I found you through your website.`)}`
    : null;
  const heroCall = waHref
    ? `\n    <a class="cta cta-secondary" href="${waHref}" target="_blank" rel="noopener">📞 Call us</a>`
    : "";
  const style = params.theme?.style ?? "minimal";
  const heroImg = images[0]
    ? `\n    <img class="hero-img" src="${esc(images[0])}" alt="${esc(companyName)}" />`
    : "";
  // Structural variety: bold/corporate sites with an image use a side-by-side
  // hero instead of the stacked centered one.
  const splitHero = Boolean(images[0]) && (style === "bold" || style === "corporate");
  // Google reviews (owner-provided GMB link, top 3 extracted).
  const reviews = (params.reviews ?? []).slice(0, 3);
  const stars = (n: number) => "★".repeat(Math.max(1, Math.min(5, Math.round(n)))) + "☆".repeat(5 - Math.max(1, Math.min(5, Math.round(n))));
  const reviewsSection = reviews.length
    ? `\n  <section class="reviews">
    <h2>What our customers say</h2>
    <div class="reviews-grid">
${reviews
  .map(
    (r) => `      <blockquote class="card"><span class="stars" aria-label="${Math.round(r.rating)} out of 5 stars">${stars(r.rating)}</span><p>${esc(r.text)}</p><cite>— ${esc(r.author)}${params.gmbUrl ? ", on Google" : ""}</cite></blockquote>`,
  )
  .join("\n")}
    </div>${params.gmbUrl ? `\n    <p class="reviews-more"><a href="${esc(params.gmbUrl)}" target="_blank" rel="noopener">See all our Google reviews →</a></p>` : ""}
  </section>`
    : "";

  const gallery = images.length > 1
    ? `\n  <section class="gallery">\n${images
        .slice(1)
        .map((u) => `    <img src="${esc(u)}" alt="${esc(companyName)}" loading="lazy" />`)
        .join("\n")}\n  </section>`
    : "";

  const index = shell({
    companyId: params.companyId,
    companyName,
    title: `${companyName} — ${copy.heroHeadline}`,
    description: copy.heroSubheadline,
    active: "index",
    theme: params.theme,
    phone: params.phone,
    facebookUrl: params.facebookUrl,
    instagramUrl: params.instagramUrl,
    youtubeUrl: params.youtubeUrl,
    linkedinUrl: params.linkedinUrl,
    body: (splitHero
      ? `  <section class="hero hero-split">
    <div>
      <h1>${esc(copy.heroHeadline)}</h1>
      <p>${esc(copy.heroSubheadline)}</p>
      <a class="cta" href="contact.html">${esc(copy.cta)}</a>${heroCall}
    </div>${heroImg}
  </section>`
      : `  <section class="hero">
    <h1>${esc(copy.heroHeadline)}</h1>
    <p>${esc(copy.heroSubheadline)}</p>
    <a class="cta" href="contact.html">${esc(copy.cta)}</a>${heroCall}${heroImg}
  </section>`) + `${gallery}
  <section class="features">
${copy.features.map((f) => `    <div><h3>${esc(f.title)}</h3><p>${esc(f.description)}</p></div>`).join("\n")}
  </section>${reviewsSection}
  <section class="faq">
    <h2>FAQ</h2>
${copy.faq.map((q) => `    <details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join("\n")}
  </section>`,
  });

  const about = shell({
    companyId: params.companyId,
    companyName,
    title: `About — ${companyName}`,
    description: params.tagline ?? copy.heroSubheadline,
    active: "about",
    theme: params.theme,
    phone: params.phone,
    facebookUrl: params.facebookUrl,
    instagramUrl: params.instagramUrl,
    youtubeUrl: params.youtubeUrl,
    linkedinUrl: params.linkedinUrl,
    body: `  <section class="page">
    <h1>About ${esc(companyName)}</h1>
${params.tagline ? `    <p><strong>${esc(params.tagline)}</strong></p>` : ""}
${params.ideaSummary ? `    <p>${esc(params.ideaSummary)}</p>` : ""}
${params.positioning ? `    <h2>Who we serve</h2>\n    <p>${esc(params.positioning)}</p>` : ""}
    <h2>How we work</h2>
    <p>${esc(copy.heroSubheadline)}</p>
    <a class="cta" href="contact.html">${esc(copy.cta)}</a>
  </section>`,
  });

  const services = shell({
    companyId: params.companyId,
    companyName,
    title: `Services — ${companyName}`,
    description: copy.heroSubheadline,
    active: "services",
    theme: params.theme,
    phone: params.phone,
    facebookUrl: params.facebookUrl,
    instagramUrl: params.instagramUrl,
    youtubeUrl: params.youtubeUrl,
    linkedinUrl: params.linkedinUrl,
    body: `  <section class="page">
    <h1>What we offer</h1>
${copy.features
  .map((f) => `    <div class="card"><h3>${esc(f.title)}</h3><p>${esc(f.description)}</p></div>`)
  .join("\n")}
    <a class="cta" href="contact.html">${esc(copy.cta)}</a>
  </section>`,
  });

  const contact = shell({
    companyId: params.companyId,
    companyName,
    title: `Contact — ${companyName}`,
    description: `Get in touch with ${companyName}`,
    active: "contact",
    theme: params.theme,
    phone: params.phone,
    facebookUrl: params.facebookUrl,
    instagramUrl: params.instagramUrl,
    youtubeUrl: params.youtubeUrl,
    linkedinUrl: params.linkedinUrl,
    body: `  <section class="page">
    <h1>Contact us</h1>
${waHref ? `    <p>Chat with us directly on WhatsApp — we usually reply within minutes.</p>\n    <p><a class="cta" href="${waHref}" target="_blank" rel="noopener">💬 Chat on WhatsApp</a></p>\n    <p>Or send us a message and we'll get back to you.</p>` : `    <p>Send us a message and we'll get back to you.</p>`}
    <form id="lead-form">
      <div><label for="name">Name</label><input id="name" name="name" required maxlength="120" /></div>
      <div><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="200" /></div>
      <div><label for="message">Message</label><textarea id="message" name="message" rows="5" required minlength="5" maxlength="4000"></textarea></div>
      <div><button type="submit">Send message</button></div>
      <p class="form-note">Your details are used only to reply to you, and are shared only with ${esc(companyName)}.</p>
      <p class="form-note" id="form-note"></p>
    </form>
  </section>
  <script>
    document.getElementById("lead-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = this.querySelector("button");
      var note = document.getElementById("form-note");
      btn.disabled = true;
      note.className = "form-note";
      note.textContent = "Sending…";
      try {
        var res = await fetch("${PLATFORM_URL}/api/public/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: "${params.companyId}",
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            message: document.getElementById("message").value,
          }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not send");
        note.className = "form-note ok";
        note.textContent = "Thanks! We received your message and will reply by email.";
        this.reset();
      } catch (err) {
        note.className = "form-note err";
        note.textContent = err && err.message ? err.message : "Could not send — please retry.";
      } finally {
        btn.disabled = false;
      }
    });
  </script>`,
  });

  return [
    { path: "index.html", content: index },
    { path: "about.html", content: about },
    { path: "services.html", content: services },
    { path: "contact.html", content: contact },
  ];
}
