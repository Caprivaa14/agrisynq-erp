import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getPayablesAgeing } from '@/actions/accounting';
import APClient from './APClient';

export const metadata: Metadata = { title: 'AP — Payables — FertiLedger ERP' };

export default async function APPage() {
  try { await getUserContext(); } catch { redirect('/login'); }
  const rows = await getPayablesAgeing();
  return <APClient initialData={rows as unknown as Parameters<typeof APClient>[0]['initialData']} />;
}
