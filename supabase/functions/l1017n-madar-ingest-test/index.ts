const expectedTestHash = "4a71c83112b99c2199d87bc02a82b2b699b3dd5a65585839b35636b741925e90";

async function checkTestMessage(message: unknown): Promise<string | null> {
  if (message == null || message === "") return "message_empty";
  if (typeof message !== "string") return "message_not_text";
  const text = message.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu, "").trim();
  if (!text) return "message_empty";
  // Check the test code independently of Arabic spacing and notification formatting.
  const codes = text.toLowerCase().match(/\b[0-9a-f]{24}\b/g) ?? [];
  for (const code of codes) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    if (hash === expectedTestHash) return null;
  }
  return codes.length ? "test_code_mismatch" : "test_code_missing";
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "post_required" }, { status: 405 });
  }

  // This test accepts a synthetic message only and never stores or credits a transfer.
  if (!request.body) {
    return Response.json({ ok: false, error: "body_required" }, { status: 400 });
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let raw = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) {
        await reader.cancel();
        return Response.json({ ok: false, error: "body_too_large" }, { status: 413 });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const payload = JSON.parse(raw);
    const error = await checkTestMessage(payload?.message);
    if (error) return Response.json({ ok: false, error }, { status: 422 });
    return Response.json({ ok: true, message: "وصل نص الاختبار" });
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
});
