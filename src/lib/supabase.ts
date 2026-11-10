import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env.NEXT_PUBLIC_ZERONE_DEMO_MODE === "1" ? "http://127.0.0.1:54321" : undefined);
// Support both standard anon key and publishable key naming
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (process.env.NEXT_PUBLIC_ZERONE_DEMO_MODE === "1" ? "local-demo-placeholder" : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)"
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
