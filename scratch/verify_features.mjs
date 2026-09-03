import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function verify() {
  console.log('Testing live DB features...');

  // 1. Check issue_comments and user_starred_resources tables
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('issue_comments', 'user_starred_resources')
    ORDER BY table_name;
  `;
  console.log('Tables present:', tables.map(t => t.table_name));

  // 2. Check blocks and slots count
  const [blocksCount] = await sql`SELECT COUNT(*)::int as count FROM logical_block_slots;`;
  console.log('Total logical block slots:', blocksCount.count);

  // 3. Check blobs count & CAS deduplication
  const [blobsCount] = await sql`SELECT COUNT(*)::int as count FROM content_blobs;`;
  console.log('Total content blobs (CAS):', blobsCount.count);

  // 4. Test query on resources ISA
  const resources = await sql`
    SELECT r.resource_id, r.resource_type, r.created_at, COALESCE(nb.title, n.title) as title
    FROM resources r
    LEFT JOIN notebooks nb ON nb.notebook_id = r.resource_id
    LEFT JOIN notes n ON n.note_id = r.resource_id
    LIMIT 3;
  `;
  console.log('Polymorphic resources sample:', resources);

  console.log('✅ Live Database verification complete!');
}

verify().catch(console.error);
