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

          // Parse metadata from draft files
          const lines = content.split('\n');
          const meta: Record<string, string> = {};
          for (const line of lines.slice(0, 10)) {
            const match = line.match(/^([A-Z ]+):\s*(.+)/);
            if (match) meta[match[1].trim().toLowerCase()] = match[2].trim();
          }

          // Extract date from filename (YYYYMMDD)
          const dateMatch = filename.match(/(\d{8})/);
          const date = dateMatch
            ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}`
            : null;

          // Extract post body (between [POST BEGINS] and [POST ENDS])
          const bodyStart = content.indexOf('[POST BEGINS BELOW THIS LINE]');
          const bodyEnd = content.indexOf('[POST ENDS ABOVE THIS LINE]');
          const postBody =
            bodyStart > -1 && bodyEnd > -1
              ? content.slice(bodyStart + '[POST BEGINS BELOW THIS LINE]'.length, bodyEnd).trim()
              : null;

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
