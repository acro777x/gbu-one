/**
 * GBU One - a tiny registry of the documents the app wants to open.
 *
 * The university's file links carry a query string of their own
 * (`.../DownloadFile?nName=...`), which does not survive a round trip
 * through a route's parameters. The app therefore hands the viewer a short
 * id and looks the address up here, in the same process.
 */

export interface RegisteredDocument {
  url: string;
  title?: string;
}

const documents = new Map<string, RegisteredDocument>();
let counter = 0;

/** Stores a document and returns the id the viewer route takes. */
export function registerDocument(url: string, title?: string): string {
  counter += 1;
  const id = `doc_${Date.now().toString(36)}_${counter}`;
  documents.set(id, { url, title });
  return id;
}

/** Looks a document up. */
export function getDocument(id: string | undefined): RegisteredDocument | undefined {
  if (!id) return undefined;
  return documents.get(id);
}

/** Forgets a document once it has been opened. */
export function releaseDocument(id: string | undefined): void {
  if (id) documents.delete(id);
}
