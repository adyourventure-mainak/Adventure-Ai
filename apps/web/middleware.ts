import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/c/", "/admin"];

export async function middleware(request: NextRequest) {
  // One canonical host. Auth cookies (incl. the PKCE code verifier) are
  // host-only: a login started on adventure-ai.in cannot complete on
  // www.adventure-ai.in. Fold www onto the apex before anything else.
  if (request.nextUrl.hostname === "www.adventure-ai.in") {
    const url = request.nextUrl.clone();
    url.hostname = "adventure-ai.in";
    return NextResponse.redirect(url, 308);
  }

  // Rescue net: if Supabase's redirect allowlist rejects our callback URL it
  // falls back to the Site URL and delivers the PKCE code to the HOMEPAGE
  // (e.g. https://www.adventure-ai.in/?code=...). Nothing there exchanges it,
  // so the login silently dies. Route any ?code= landing on / to the callback.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p));
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Exclude auth/callback: it exchanges the OAuth/magic-link code and sets the
  // session cookies itself — running getUser() here can rotate them mid-flight
  // and force a second login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|auth/callback).*)"],
};
