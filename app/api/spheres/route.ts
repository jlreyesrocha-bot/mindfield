import { NextResponse } from 'next/server';
import { MOCK_SPHERES } from '@/lib/mock-data';

export async function GET() {
  // No auth configured yet — return mock spheres instead of 401
  const session = null;

  if (!session) {
    return NextResponse.json(MOCK_SPHERES);
  }

  // Placeholder for authenticated data fetching
  return NextResponse.json(MOCK_SPHERES);
}
