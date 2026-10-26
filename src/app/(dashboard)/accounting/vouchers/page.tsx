import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getJournalVouchers } from '@/actions/accounting';
import JournalVouchersClient from './JournalVouchersClient';

export const metadata: Metadata = { title: 'Journal Vouchers — FertiLedger ERP' };

export default async function JournalVouchersPage() {
  try { await getUserContext(); } catch { redirect('/login'); }
  const vouchers = await getJournalVouchers();
  return <JournalVouchersClient initialData={vouchers as unknown as Parameters<typeof JournalVouchersClient>[0]['initialData']} />;
}
