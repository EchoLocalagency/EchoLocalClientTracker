import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const DRAFTS_DIR = '/Users/brianegan/EchoLocalColdEmail/linkedin_drafts';

export async function GET() {
  try {
    const files = await readdir(DRAFTS_DIR);

    const drafts = await Promise.all(
      files
        .filter((f) => f.endsWith('.txt') || f.endsWith('.md'))
        .sort()
        .reverse()
        .map(async (filename) => {
          const content = await readFile(join(DRAFTS_DIR, filename), 'utf-8');

          // Parse metadata from draft files (mixed case keys like "Pillar:", "Status:", etc.)
          const lines = content.split('\n');
          const meta: Record<string, string> = {};
          for (const line of lines.slice(0, 15)) {
            const match = line.match(/^([A-Za-z ]+):\s*(.+)/);
            if (match) meta[match[1].trim().toLowerCase()] = match[2].trim();
          }

          // Extract date from filename (YYYYMMDD)
          const dateMatch = filename.match(/(\d{8})/);
          const date = dateMatch
            ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}`
            : null;

          // Extract post body - try multiple marker formats
          let postBody: string | null = null;

          // Format 1: [POST BEGINS BELOW THIS LINE] ... [POST ENDS ABOVE THIS LINE]
          const bodyStart1 = content.indexOf('[POST BEGINS BELOW THIS LINE]');
          const bodyEnd1 = content.indexOf('[POST ENDS ABOVE THIS LINE]');
          if (bodyStart1 > -1 && bodyEnd1 > -1) {
            postBody = content.slice(bodyStart1 + '[POST BEGINS BELOW THIS LINE]'.length, bodyEnd1).trim();
          }

          // Format 2: "POST TEXT (copy exactly):" ... next "---"
          if (!postBody) {
            const postTextIdx = content.indexOf('POST TEXT');
            if (postTextIdx > -1) {
              // Skip past the "POST TEXT (copy exactly):" line
              const lineEnd = content.indexOf('\n', postTextIdx);
              const afterMarker = lineEnd > -1 ? content.slice(lineEnd + 1) : content.slice(postTextIdx);
              const nextSeparator = afterMarker.indexOf('\n---');
              postBody = nextSeparator > -1
                ? afterMarker.slice(0, nextSeparator).trim()
                : afterMarker.trim();
            }
          }

          const isResearch = filename.startsWith('research-');

          return {
            filename,
            date,
            type: isResearch ? 'research' : 'draft',
            pillar: meta['pillar'] || null,
            format: meta['format'] || null,
            status: meta['status'] || null,
            hook_type: meta['hook type'] || null,
            char_count: postBody ? postBody.length : content.length,
            post_body: postBody,
            content,
          };
        })
    );

    return Response.json({
      total: drafts.length,
      drafts: drafts.filter((d) => d.type === 'draft'),
      research: drafts.filter((d) => d.type === 'research'),
    });
  } catch {
    return Response.json({ total: 0, drafts: [], research: [] });
  }
}
