import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Node's built-in scrypt: no native add-ons, works on every OS and in Docker.
const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key)
    );
  });
}

/** Format: scrypt$N$r$p$<salt base64>$<hash base64> */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, PARAMS);

  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");

  if (scheme !== "scrypt" || !saltB64 || !hashB64) {
    return false;
  }

  const expected = Buffer.from(hashB64, "base64");
  const key = await deriveKey(password, Buffer.from(saltB64, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });

  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Lowercase, trimmed, 3–40 characters of letters, digits, dot, dash, underscore. */
export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  return /^[a-z0-9._-]{3,40}$/.test(username) ? username : null;
}

export function isAcceptablePassword(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}
