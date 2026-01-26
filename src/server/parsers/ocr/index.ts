import type { Invoice } from "@/src/types";

export async function parseWithOcr(_input: Buffer): Promise<Partial<Invoice>> {
  // Placeholder: integrate an OCR provider later (optional).
  return {};
}

