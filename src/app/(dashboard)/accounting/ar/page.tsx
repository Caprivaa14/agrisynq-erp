import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getReceivablesAgeing } from '@/actions/accounting';
import ARClient from './ARClient';

export const metadata: Metadata = { title: 'AR — Receivables — FertiLedger ERP' };

export default async function ARPage() {
  try { await getUserContext(); } catch { redirect('/login'); }
  const rows = await getReceivablesAgeing();
  return <ARClient initialData={rows as unknown as Parameters<typeof ARClient>[0]['initialData']} />;
}
