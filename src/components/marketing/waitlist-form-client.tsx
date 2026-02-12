'use client';

import { useSearchParams } from 'next/navigation';
import {
  WaitlistForm as WaitlistFormBase,
  type WaitlistFormProps,
} from './waitlist-form';

export function WaitlistForm(props: Omit<WaitlistFormProps, 'referralCode'>) {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');

  return <WaitlistFormBase {...props} referralCode={referralCode} />;
}

export { WaitlistFormBase };
