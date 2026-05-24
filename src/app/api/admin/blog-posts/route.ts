import { NextResponse } from 'next/server';

const gone = () =>
  NextResponse.json(
    {
      error: 'Gone',
      message: 'Blog admin moved to brik-client-portal /settings/blog-posts.',
      moved_to: 'https://portal.brikdesigns.com/settings/blog-posts',
    },
    { status: 410 },
  );

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}
