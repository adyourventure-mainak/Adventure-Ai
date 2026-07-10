import { prisma } from "@adventure/db";
import { supabaseServer } from "./supabase/server";

export interface AuthedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Returns the authenticated user, mirroring them into our `users` table on
 * first sight (id = Supabase auth uid). Returns null when not signed in.
 */
export async function getUser(): Promise<AuthedUser | null> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email, name: user.user_metadata?.full_name ?? null },
    update: { email: user.email },
    select: { id: true, email: true, isAdmin: true, deletedAt: true },
  });
  // Deletion in progress: the account is dead even if the auth session
  // briefly survives while the worker finishes the teardown.
  if (dbUser.deletedAt) return null;
  return { id: dbUser.id, email: dbUser.email, isAdmin: dbUser.isAdmin };
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
