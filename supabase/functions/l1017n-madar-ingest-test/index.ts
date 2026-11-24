const expectedTestHash = "07d9a39e175d5f08abbc2a40d8a465eb352582c3696b5e904d14c418fd701a71";

async function isAuthorizedTestMessage(message: string) {
  const normalized = message.trim().replace(/مدار\s+742/u, "مدار742");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return hash === expectedTestHash;
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
    if (typeof payload?.message === "string" && await isAuthorizedTestMessage(payload.message)) {
      return Response.json({ ok: true, message: "وصل نص الاختبار" });
    }
    return Response.json({ ok: false, error: "test_message_required" }, { status: 422 });
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
});
