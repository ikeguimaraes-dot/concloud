export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth';
export default async function Home() {
  redirect((await currentActor()) ? '/escritorio' : '/login');
}
