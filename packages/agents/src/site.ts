import type { LandingCopy } from "@adventure/core";

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
  copy: LandingCopy;
}

const CSS = `
  :root { --accent: #fb7f14; --ink: #161619; --muted: #4c4e57; }
  * { margin: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--ink); line-height: 1.6; }
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
  .cta { display: inline-block; margin-top: 32px; background: var(--accent); color: #fff; padding: 14px 32px; border-radius: 10px; font-weight: 600; text-decoration: none; }
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
  .faq { padding: 0 0 96px; max-width: 720px; margin: 0 auto; }
  .faq h2 { text-align: center; margin-bottom: 32px; }
  .faq details { border-bottom: 1px solid #eee; padding: 16px 0; }
  .faq summary { font-weight: 600; cursor: pointer; }
  .faq p { color: var(--muted); margin-top: 8px; }
  form { display: grid; gap: 14px; }
  label { font-weight: 600; font-size: 14px; }
  input, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
  button { background: var(--accent); color: #fff; border: 0; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  .form-note { font-size: 14px; }
  .form-note.ok { color: #15803d; }
  .form-note.err { color: #b91c1c; }
  footer { text-align: center; color: var(--muted); font-size: 13px; padding: 32px 0; border-top: 1px solid #eee; }
  footer a { color: var(--muted); }
`;

function shell(params: {
  companyName: string;
  title: string;
  description: string;
  active: "index" | "about" | "services" | "contact";
  body: string;
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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(params.title)}</title>
<meta name="description" content="${esc(params.description)}" />
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap"><a class="logo" href="index.html">${esc(params.companyName)}</a><nav>${nav}</nav></div></header>
<main class="wrap">
${params.body}
</main>
<footer>© ${new Date().getFullYear()} ${esc(params.companyName)} · Built and operated by <a href="${PLATFORM_URL}">Adventure AI</a></footer>
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

  const index = shell({
    companyName,
    title: `${companyName} — ${copy.heroHeadline}`,
    description: copy.heroSubheadline,
    active: "index",
    body: `  <section class="hero">
    <h1>${esc(copy.heroHeadline)}</h1>
    <p>${esc(copy.heroSubheadline)}</p>
    <a class="cta" href="contact.html">${esc(copy.cta)}</a>
  </section>
  <section class="features">
${copy.features.map((f) => `    <div><h3>${esc(f.title)}</h3><p>${esc(f.description)}</p></div>`).join("\n")}
  </section>
  <section class="faq">
    <h2>FAQ</h2>
${copy.faq.map((q) => `    <details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join("\n")}
  </section>`,
  });

  const about = shell({
    companyName,
    title: `About — ${companyName}`,
    description: params.tagline ?? copy.heroSubheadline,
    active: "about",
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
    companyName,
    title: `Services — ${companyName}`,
    description: copy.heroSubheadline,
    active: "services",
    body: `  <section class="page">
    <h1>What we offer</h1>
${copy.features
  .map((f) => `    <div class="card"><h3>${esc(f.title)}</h3><p>${esc(f.description)}</p></div>`)
  .join("\n")}
    <a class="cta" href="contact.html">${esc(copy.cta)}</a>
  </section>`,
  });

  const contact = shell({
    companyName,
    title: `Contact — ${companyName}`,
    description: `Get in touch with ${companyName}`,
    active: "contact",
    body: `  <section class="page">
    <h1>Contact us</h1>
    <p>Send us a message and we'll get back to you.</p>
    <form id="lead-form">
      <div><label for="name">Name</label><input id="name" name="name" required maxlength="120" /></div>
      <div><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="200" /></div>
      <div><label for="message">Message</label><textarea id="message" name="message" rows="5" required minlength="5" maxlength="4000"></textarea></div>
      <div><button type="submit">Send message</button></div>
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
