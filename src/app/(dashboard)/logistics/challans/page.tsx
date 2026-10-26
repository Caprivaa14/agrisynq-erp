import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/actions/context';
import { getDeliveryChallans } from '@/actions/logistics';
import ChallansClient from './ChallansClient';

export const metadata: Metadata = { title: 'Delivery Challans — FertiLedger ERP' };

export default async function ChallansPage() {
  try {
    await getUserContext();
  } catch {
    redirect('/login');
  }

  const challans = await getDeliveryChallans();

  return (
    <ChallansClient
      initialData={challans as unknown as Parameters<typeof ChallansClient>[0]['initialData']}
    />
  );
}
