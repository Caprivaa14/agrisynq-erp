import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getTrialBalance } from '@/actions/accounting';
import TrialBalanceClient from './TrialBalanceClient';

export const metadata: Metadata = { title: 'Trial Balance — FertiLedger ERP' };

export default async function TrialBalancePage() {
  try { await getUserContext(); } catch { redirect('/login'); }
  const rows = await getTrialBalance();
  return <TrialBalanceClient initialData={rows as unknown as Parameters<typeof TrialBalanceClient>[0]['initialData']} />;
}
