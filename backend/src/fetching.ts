/**
 * Fetch a page and extract readable text. Failures return null (the
 * source is then listed but unverified) — a failed fetch never fails
 * the whole report.
 */

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(noscript|template)[\s\S]*?<\/(noscript|template)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPageText(url: string, cap = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "livedocs-meta (research bot; contact: report page)",
        Accept: "text/html, text/plain, text/markdown, */*",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    const plain = text.trimStart().startsWith("<") ? stripHtml(text) : text;
    if (!plain) return null;
    return plain.slice(0, cap);
  } catch {
    return null;
  }
}
