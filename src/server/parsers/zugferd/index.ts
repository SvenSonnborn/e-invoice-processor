import type { Invoice } from "@/src/types";

export async function parseZugferd(_input: Buffer): Promise<Invoice> {
  // Placeholder: implement ZUGFeRD extraction (PDF + embedded XML) later.
  return { id: "placeholder", format: "ZUGFERD" };
}

