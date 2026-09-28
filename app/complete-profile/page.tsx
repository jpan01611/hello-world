'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CompleteProfilePage() {
    const router = useRouter();
    const supabase = createClient();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/login');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();

            // If the profile is already complete, there's nothing to do here.
            if (profile?.first_name && profile?.last_name) {
                router.replace('/');
                return;
            }

            setFirstName(profile?.first_name ?? '');
            setLastName(profile?.last_name ?? '');
            setChecking(false);
        }

        load();
    }, [router, supabase]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.replace('/login');
            return;
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
            })
            .eq('id', user.id);

        setLoading(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }

        router.replace('/');
        router.refresh();
    }

    if (checking) {
        return (
            <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
                <p className="text-black dark:text-zinc-50">Loading…</p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 font-sans dark:bg-black">
            <div className="w-full max-w-sm">
                <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
                    Tell us about yourself
                </h1>
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                    We just need your first and last name to finish setting up your account.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1 text-sm text-black dark:text-zinc-50">
                        First name
                        <input
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="rounded-md border border-black/15 bg-white px-3 py-2 text-black dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-black dark:text-zinc-50">
                        Last name
                        <input
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="rounded-md border border-black/15 bg-white px-3 py-2 text-black dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                    </label>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 h-11 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
                    >
                        {loading ? 'Saving…' : 'Save and continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
