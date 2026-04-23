import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api-utils';
import { SKILLS_MAP } from '../skills-data';

export const runtime = 'edge';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const skill = SKILLS_MAP.get(id);

  if (!skill) {
    return errorResponse(
      `Skill "${id}" not found. GET /api/skills to list available skills.`,
      404,
    );
  }

  const frontmatter = [
    '---',
    `id: ${skill.id}`,
    `name: "${skill.name}"`,
    `description: "${skill.description}"`,
    `category: ${skill.category}`,
    `endpoints:`,
    ...skill.relatedEndpoints.map((e) => `  - ${e}`),
    '---',
    '',
  ].join('\n');

  return new NextResponse(frontmatter + skill.content, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
