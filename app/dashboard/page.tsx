import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

// Example protected route: only reachable while logged in.
export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 font-sans dark:bg-black">
            <div className="w-full max-w-sm text-center sm:text-left">
                <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
                    Dashboard
                </h1>
                <p className="mb-6 text-zinc-600 dark:text-zinc-400">
                    This page only renders for signed-in users. Welcome,{' '}
                    {profile?.first_name ?? user.email}!
                </p>
                <Link href="/profile" className="text-blue-600 underline">
                    Edit your profile
                </Link>
            </div>
        </div>
    );
}
