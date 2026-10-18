declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GEMINI_API_KEY?:string;
    SUPADATA_API_KEY?:string;
    RECIPEEK_IMPORT_VIDEO?:string;
    RECIPEEK_IMPORT_QUEUE_TOKEN?:string;
    RECIPEEK_AI_MONTHLY_BUDGET_USD?:string;
    RECIPEEK_SUPADATA_MONTHLY_CREDITS?:string;
    RECIPEEK_AI_ALLOWED_PROFILES?:string;
    RECIPEEK_IMPORT_ADMIN_PROFILES?:string;
    BUCKET?: R2Bucket;
    RECIPEEK_AUTH_MODE?: 'sites'|'supabase';
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    RECIPEEK_LEGACY_AUTH_ID?: string;
    RECIPEEK_LEGACY_PROFILE_ID?: string;
    RECIPEEK_EMAIL_DELIVERY_READY?: string;
  }
}
