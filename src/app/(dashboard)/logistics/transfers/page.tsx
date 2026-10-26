import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getStockTransfers } from '@/actions/logistics';
import StockTransfersClient from './StockTransfersClient';

export const metadata: Metadata = { title: 'Stock Transfers — FertiLedger ERP' };

export default async function StockTransfersPage() {
  try {
    await getUserContext();
  } catch {
    redirect('/login');
  }

  const transfers = await getStockTransfers();

  return <StockTransfersClient initialData={transfers as unknown as Parameters<typeof StockTransfersClient>[0]['initialData']} />;
}
