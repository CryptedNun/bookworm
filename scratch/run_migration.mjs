import { neon } from '@neondatabase/serverless';

const databaseUrl = "postgresql://neondb_owner:npg_OEzNc5uvl1dM@ep-weathered-dream-azffspwq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(databaseUrl);

async function run() {
  console.log('Connecting to Neon database...');
  
  console.log('1. Creating issue_comments table...');
  await sql`
    CREATE TABLE IF NOT EXISTS issue_comments (
        comment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_id    UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
        author_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        content     TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ
    )
  `;

  console.log('2. Creating index on issue_comments...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_created 
        ON issue_comments (issue_id, created_at ASC)
  `;

  console.log('3. Creating user_starred_resources table...');
  await sql`
    CREATE TABLE IF NOT EXISTS user_starred_resources (
        user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        resource_id UUID NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, resource_id)
    )
  `;

  console.log('4. Creating index on user_starred_resources...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_starred_user_created
        ON user_starred_resources (user_id, created_at DESC)
  `;

  console.log('5. Verifying created tables...');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('issue_comments', 'user_starred_resources')
  `;
  console.log('Found tables:', tables);
  console.log('Migration 003 completed successfully!');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
