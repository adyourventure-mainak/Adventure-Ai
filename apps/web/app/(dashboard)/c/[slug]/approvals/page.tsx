import { redirect } from "next/navigation";

// The approval step was removed — deliverables ship straight to the inbox.
export default function ApprovalsPage({ params }: { params: { slug: string } }) {
  redirect(`/c/${params.slug}/inbox`);
}
