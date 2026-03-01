export async function verifySignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigHex = signature.replace("sha256=", "");
  const sigBytes = new Uint8Array(
    sigHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  return await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(body),
  );
}
