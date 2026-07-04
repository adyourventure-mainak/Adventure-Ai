import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            Adventure <span className="text-brand-500">AI</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {user.isAdmin && (
              <Link href="/admin" className="text-ink-400 hover:text-white">
                Admin
              </Link>
            )}
            <span className="text-ink-400">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm">Sign out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
