export * from "./client";
import { createStorageClient } from "./client";

/** Singleton storage client instance */
export const storage = createStorageClient();
