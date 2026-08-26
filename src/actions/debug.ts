/**
 * Debug Server Action
 * 
 * Diagnose what's in the database for a specific notebook
 */

'use server';

import { sql } from '@/lib/db';
import { getCurrentUser } from './auth';

export async function debugNotebookContent(notebookId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'Not authenticated' };
    }

    // 1. Check notebook exists
    const [notebook] = await sql`
      SELECT * FROM notebooks WHERE notebook_id = ${notebookId}
    `;
    
    // 2. Get notes
    const notes = await sql`
      SELECT * FROM notes WHERE notebook_id = ${notebookId} AND deleted_at IS NULL
    `;

    // 3. For first note, trace through the layers
    const noteDebugs = await Promise.all(notes.map(async (note: any) => {
      // Get branches
      const branches = await sql`
        SELECT * FROM branches WHERE note_id = ${note.note_id}
      `;

      const mainBranch = branches.find((b: any) => b.is_main);

      if (!mainBranch) {
        return {
          note_id: note.note_id,
          title: note.title,
          problem: 'No main branch found',
          branches
        };
      }

      // Get commits on main branch
      const commits = await sql`
        SELECT * FROM commits WHERE branch_id = ${mainBranch.branch_id} ORDER BY committed_at DESC
      `;

      if (commits.length === 0) {
        return {
          note_id: note.note_id,
          title: note.title,
          problem: 'No commits on main branch',
          mainBranch
        };
      }

      const latestCommit = commits[0];

      // Get manifests for latest commit
      const manifests = await sql`
        SELECT * FROM commit_manifests WHERE commit_id = ${latestCommit.commit_id}
      `;

      if (manifests.length === 0) {
        return {
          note_id: note.note_id,
          title: note.title,
          problem: 'No manifests for latest commit',
          latestCommit
        };
      }

      // Get first manifest details
      const firstManifest: any = manifests[0];

      // Get slot
      const [slot] = await sql`
        SELECT * FROM logical_block_slots WHERE slot_id = ${firstManifest.slot_id}
      `;

      // Get version
      const [version] = await sql`
        SELECT * FROM block_version_contents WHERE version_id = ${firstManifest.version_id}
      `;

      // Get blob
      let blob = null;
      if (version) {
        const [blobResult] = await sql`
          SELECT * FROM content_blobs WHERE sha256 = ${version.content_blob_hash}
        `;
        blob = blobResult;
      }

      return {
        note_id: note.note_id,
        title: note.title,
        mainBranch: mainBranch.branch_id,
        commits_count: commits.length,
        latest_commit: latestCommit.commit_id,
        manifests_count: manifests.length,
        sample_manifest: firstManifest,
        sample_slot: slot,
        sample_version: version,
        sample_blob: blob ? { sha256: blob.sha256, content_preview: blob.content_text?.substring(0, 100) } : null
      };
    }));

    return {
      notebook,
      notes_count: notes.length,
      note_details: noteDebugs
    };
  } catch (error: any) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}
