declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    RECIPEEK_AUTH_MODE?: 'sites'|'supabase';
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
  }
}
