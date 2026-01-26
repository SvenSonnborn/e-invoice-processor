import { describe, it, expect } from "bun:test";
import { generateToken } from "@/src/lib/security/crypto";

describe("Crypto utilities", () => {
  describe("generateToken", () => {
    it("should generate a UUID token", () => {
      const token = generateToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
    });

    it("should generate unique tokens", () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it("should generate valid UUID format", () => {
      const token = generateToken();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(token).toMatch(uuidRegex);
    });
  });
});
