import type { LandingCopy } from "@adventure/core";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Deterministic landing page renderer: LandingPage.copy JSON → static HTML.
 * The Engineer agent edits the copy JSON with the LLM; this template turns it
 * into the deployable site, so deploys are reproducible and reviewable.
 */
export function renderLandingHtml(params: {
  companyName: string;
  tagline?: string;
  copy: LandingCopy;
}): string {
  const { companyName, copy } = params;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(companyName)} — ${esc(copy.heroHeadline)}</title>
<meta name="description" content="${esc(copy.heroSubheadline)}" />
<style>
  :root { --accent: #fb7f14; --ink: #161619; --muted: #4c4e57; }
  * { margin: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--ink); line-height: 1.6; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }
  header { padding: 20px 0; border-bottom: 1px solid #eee; }
  .logo { font-weight: 700; font-size: 20px; }
  .hero { text-align: center; padding: 96px 0 72px; }
  .hero h1 { font-size: 44px; line-height: 1.15; max-width: 720px; margin: 0 auto; }
  .hero p { font-size: 20px; color: var(--muted); max-width: 560px; margin: 20px auto 0; }
  .cta { display: inline-block; margin-top: 32px; background: var(--accent); color: #fff; padding: 14px 32px; border-radius: 10px; font-weight: 600; text-decoration: none; }
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px; padding: 48px 0 72px; }
  .features h3 { margin-bottom: 8px; }
  .features p { color: var(--muted); font-size: 15px; }
  .faq { padding: 0 0 96px; max-width: 720px; margin: 0 auto; }
  .faq h2 { text-align: center; margin-bottom: 32px; }
  .faq details { border-bottom: 1px solid #eee; padding: 16px 0; }
  .faq summary { font-weight: 600; cursor: pointer; }
  .faq p { color: var(--muted); margin-top: 8px; }
  footer { text-align: center; color: var(--muted); font-size: 13px; padding: 32px 0; border-top: 1px solid #eee; }
</style>
</head>
<body>
<header><div class="wrap"><span class="logo">${esc(companyName)}</span></div></header>
<main class="wrap">
  <section class="hero">
    <h1>${esc(copy.heroHeadline)}</h1>
    <p>${esc(copy.heroSubheadline)}</p>
    <a class="cta" href="#contact">${esc(copy.cta)}</a>
  </section>
  <section class="features">
${copy.features.map((f) => `    <div><h3>${esc(f.title)}</h3><p>${esc(f.description)}</p></div>`).join("\n")}
  </section>
  <section class="faq" id="contact">
    <h2>FAQ</h2>
${copy.faq.map((q) => `    <details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join("\n")}
  </section>
</main>
<footer>© ${new Date().getFullYear()} ${esc(companyName)} · Built and operated by Adventure AI</footer>
</body>
</html>
`;
}
