declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    RYE_ADMIN_EMAILS?: string;
    RYE_LOCAL_REVIEWER_EMAIL?: string;
    RYE_MYSQL_API_URL?: string;
    RYE_MYSQL_API_TOKEN?: string;
  }
}
