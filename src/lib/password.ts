/**
 * Password hashing using Node's built-in `scrypt` — no native deps, works
 * on every platform (incl. Vercel / serverless) and is as strong as bcrypt
 * when configured correctly.
 *
 * Format stored in DB: `scrypt$N$r$p$saltB64$hashB64`
 *   N = CPU/memory cost (16384)
 *   r = block size (8)
 *   p = parallelisation (1)
 *   saltB64 = 16-byte random salt
 *   hashB64 = 64-byte derived key
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
    password: string | Buffer,
    salt: string | Buffer,
    keylen: number,
    options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_LEN = 16;
const MAXMEM = 64 * 1024 * 1024; // 64 MiB

export const hashPassword = async (plain: string): Promise<string> => {
    if (!plain || plain.length < 8) {
        throw new Error("Password must be at least 8 characters.");
    }
    const salt = randomBytes(SALT_LEN);
    const derived = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
    return [
        "scrypt",
        N.toString(),
        R.toString(),
        P.toString(),
        salt.toString("base64"),
        derived.toString("base64"),
    ].join("$");
};

export const verifyPassword = async (
    plain: string,
    stored: string | null | undefined,
): Promise<boolean> => {
    if (!plain || !stored) return false;
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
    if (!saltB64 || !hashB64) return false;
    const nVal = Number(nStr);
    const rVal = Number(rStr);
    const pVal = Number(pStr);
    if (!Number.isFinite(nVal) || !Number.isFinite(rVal) || !Number.isFinite(pVal)) {
        return false;
    }

    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await scrypt(plain, salt, expected.length, {
        N: nVal,
        r: rVal,
        p: pVal,
        maxmem: MAXMEM,
    });

    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
};
