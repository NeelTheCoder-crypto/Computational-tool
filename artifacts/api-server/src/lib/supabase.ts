import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"];
// Use the service role key to bypass Row Level Security for server-side reads.
// This key is never sent to the browser — it lives only in the Express process.
const supabaseKey =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL environment variable is required");
}
if (!supabaseKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variable is required"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
