import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * OAuth / magic-link callback. Exchanges the PKCE code for a session and — the
 * part that matters — writes the resulting session cookies directly onto the
 * redirect response returned to the browser. Writing them to the next/headers
 * store and then returning a separately-constructed redirect drops the cookies
 * on the first hop, which lands the user on a protected route with no session
 * and forces a second login. See middleware matcher: this route is excluded so
 * nothing rotates the cookies mid-exchange.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const fail = () => NextResponse.redirect(new URL("/login?error=auth", url.origin));

  // The response we'll return — the code-exchange writes Set-Cookie onto THIS.
  const response = NextResponse.redirect(new URL(next, url.origin));
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        // Read from the incoming request (includes the PKCE code-verifier).
        getAll() {
          return cookieStore.getAll();
        },
        // Write the new session onto the redirect the browser receives.
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No code at all — Supabase redirected with an error (e.g. a replayed flow:
  // error_code=flow_state_already_used). If an earlier pass already set a
  // session, the user IS logged in; send them on instead of showing an error.
  if (!code) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? response : fail();
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // "flow_state_already_used" & friends: the code was already exchanged by a
    // duplicate hit on this route (browser prefetch, double navigation, email
    // scanner). The FIRST exchange set valid session cookies — so if a session
    // exists, the user is logged in; continue instead of bouncing to /login.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return response;
    return fail();
  }
  return response;
}
