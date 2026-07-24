/** Minimal Vercel serverless request shape (avoids hard dep on @vercel/node). */
export interface VercelRequest {
  method?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  query: Partial<Record<string, string | string[]>>;
  headers: Partial<Record<string, string | string[]>>;
}

/** Minimal Vercel serverless response shape. */
export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
  setHeader: (name: string, value: string) => void;
}
