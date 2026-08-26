import { sql } from '@/lib/db';

export default async function DebugPage() {
  // Get CS 101 notebook
  const [notebook] = await sql`
    SELECT * FROM notebooks WHERE title ILIKE '%CS%' OR title ILIKE '%101%'
  ` as any[];

  if (!notebook) {
    return <div className="p-8">No CS 101 notebook found</div>;
  }

  // Get notes in this notebook
  const notes = await sql`
    SELECT * FROM notes WHERE notebook_id = ${notebook.notebook_id} AND deleted_at IS NULL
  ` as any[];

  // For each note, trace through the layers
  const noteDetails = await Promise.all(
    notes.map(async (note) => {
      // Get branches
      const branches = await sql`
        SELECT * FROM branches WHERE note_id = ${note.note_id}
      ` as any[];

      const mainBranch = branches.find((b) => b.is_main);

      if (!mainBranch) {
        return { note, problem: 'No main branch', branches };
      }

      // Get commits
      const commits = await sql`
        SELECT * FROM commits WHERE branch_id = ${mainBranch.branch_id} ORDER BY created_at DESC
      ` as any[];

      if (commits.length === 0) {
        return { note, problem: 'No commits', mainBranch };
      }

      const latestCommit = commits[0];

      // Get manifests
      const manifests = await sql`
        SELECT * FROM commit_manifests WHERE commit_id = ${latestCommit.commit_id}
      ` as any[];

      if (manifests.length === 0) {
        return { note, problem: 'No manifests', latestCommit };
      }

      // Get details for first manifest
      const firstManifest = manifests[0];

      const [slot] = await sql`
        SELECT * FROM logical_block_slots WHERE slot_id = ${firstManifest.slot_id}
      ` as any[];

      const [version] = await sql`
        SELECT * FROM block_version_contents WHERE version_id = ${firstManifest.version_id}
      ` as any[];

      let blob = null;
      if (version) {
        const [blobResult] = await sql`
          SELECT sha256, content_text, byte_size FROM content_blobs WHERE sha256 = ${version.blob_sha256}
        ` as any[];
        blob = blobResult;
      }

      return {
        note: { note_id: note.note_id, title: note.title },
        mainBranch: { branch_id: mainBranch.branch_id, branch_name: mainBranch.branch_name },
        commits_count: commits.length,
        latestCommit: { commit_id: latestCommit.commit_id, message: latestCommit.commit_message },
        manifests_count: manifests.length,
        firstManifest: { manifest_id: firstManifest.manifest_id, slot_id: firstManifest.slot_id, version_id: firstManifest.version_id },
        slot: slot ? { slot_id: slot.slot_id, block_type: slot.block_type, lexorank_key: slot.lexorank_key } : null,
        version: version ? { version_id: version.version_id, content_blob_hash: version.content_blob_hash } : null,
        blob: blob ? { sha256: blob.sha256, byte_size: blob.byte_size, preview: blob.content_text?.substring(0, 200) } : null,
      };
    })
  );

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Database Debug</h1>
      
      <div className="mb-8 p-4 bg-gray-800 rounded">
        <h2 className="text-xl font-bold mb-2">Notebook</h2>
        <pre className="text-sm overflow-auto">{JSON.stringify(notebook, null, 2)}</pre>
      </div>

      <div className="mb-8 p-4 bg-gray-800 rounded">
        <h2 className="text-xl font-bold mb-2">Notes Count: {notes.length}</h2>
      </div>

      {noteDetails.map((detail, idx) => (
        <div key={idx} className="mb-8 p-4 bg-gray-800 rounded">
          <h3 className="text-lg font-bold mb-4">Note: {detail.note.title}</h3>
          <pre className="text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(detail, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
