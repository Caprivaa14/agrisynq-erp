import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getPaymentReceipts } from '@/actions/accounting';
import ReceiptsClient from './ReceiptsClient';

export const metadata: Metadata = { title: 'Payment Receipts — FertiLedger ERP' };

export default async function ReceiptsPage() {
  try { await getUserContext(); } catch { redirect('/login'); }
  const receipts = await getPaymentReceipts();
  return <ReceiptsClient initialData={receipts as unknown as Parameters<typeof ReceiptsClient>[0]['initialData']} />;
}
