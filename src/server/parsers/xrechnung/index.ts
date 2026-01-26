import type { Invoice } from "@/src/types";

export async function parseXRechnung(_input: Buffer): Promise<Invoice> {
  // Placeholder: implement XRechnung XML validation + parsing later.
  return { id: "placeholder", format: "XRECHNUNG" };
}

