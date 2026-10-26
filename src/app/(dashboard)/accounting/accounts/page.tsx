import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getChartOfAccounts } from '@/actions/accounting';
import AccountsClient from './AccountsClient';

export const metadata: Metadata = { title: 'Chart of Accounts — FertiLedger ERP' };

export default async function AccountsPage() {
  try { await getUserContext(); } catch { redirect('/login'); }
  const accounts = await getChartOfAccounts();
  return <AccountsClient initialData={accounts as unknown as Parameters<typeof AccountsClient>[0]['initialData']} />;
}
