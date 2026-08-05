import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Reads NEXT_PUBLIC_* env vars — safe to use in client components.
 * Uses a singleton pattern to avoid creating multiple instances.
 */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}
