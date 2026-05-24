import { NextResponse } from 'next/server';

const gone = () =>
  NextResponse.json(
    {
      error: 'Gone',
      message:
        'Customer stories admin moved to brik-client-portal /settings/customer-stories.',
      moved_to: 'https://portal.brikdesigns.com/settings/customer-stories',
    },
    { status: 410 },
  );

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}
