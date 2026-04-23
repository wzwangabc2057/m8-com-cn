import { redirect } from 'next/navigation';

/**
 * Root page redirects to /store
 */
export default function RootPage() {
  redirect('/store');
}
