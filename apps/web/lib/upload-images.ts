// Uploads images one per request (Vercel caps request bodies at ~4.5 MB) and
// surfaces readable errors even when the platform responds without JSON.
export async function uploadImages(slug: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (file.size > 4 * 1024 * 1024) {
      throw new Error(`"${file.name}" is over 4 MB — please use a smaller image`);
    }
    const form = new FormData();
    form.append("files", file);
    const res = await fetch(`/api/companies/${slug}/uploads`, { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.urls) {
      throw new Error(
        data?.error ??
          (res.status === 413
            ? `"${file.name}" is too large to upload — please use a smaller image`
            : `Upload of "${file.name}" failed (${res.status}) — please retry`),
      );
    }
    urls.push(...data.urls);
  }
  return urls;
}
