import { describe, expect, it } from "vitest";
import {
  hashPassword,
  isAcceptablePassword,
  normalizeUsername,
  verifyPassword
} from "@/lib/auth/password";
import { hashToken, safeNextPath } from "@/lib/auth/session";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("clave-segura-1");

    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    await expect(verifyPassword("clave-segura-1", hash)).resolves.toBe(true);
    await expect(verifyPassword("clave-segura-2", hash)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("treats equivalent Unicode forms as the same password", async () => {
    const hash = await hashPassword("contraseña");
    // "ñ" written as n + combining tilde
    await expect(verifyPassword("contraseña", hash)).resolves.toBe(true);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("x", "plaintext")).resolves.toBe(false);
    await expect(verifyPassword("x", "bcrypt$1$2$3$a$b")).resolves.toBe(false);
  });
});

describe("account rules", () => {
  it("normalizes usernames and rejects invalid ones", () => {
    expect(normalizeUsername("  Prueba.Casa ")).toBe("prueba.casa");
    expect(normalizeUsername("ab")).toBeNull();
    expect(normalizeUsername("con espacio")).toBeNull();
    expect(normalizeUsername("ñandú")).toBeNull();
  });

  it("requires at least 8 characters", () => {
    expect(isAcceptablePassword("1234567")).toBe(false);
    expect(isAcceptablePassword("12345678")).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/recipes?tag=1")).toBe("/recipes?tag=1");
  });

  it("blocks external and protocol-relative redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

describe("hashToken", () => {
  it("is a stable SHA-256 hex digest", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
