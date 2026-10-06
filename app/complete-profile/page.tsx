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
            <div className="sahur-page flex flex-1 items-center justify-center px-5 py-12">
                <p role="status" className="sahur-panel p-6 font-bold">Getting your lodge pass ready…</p>
            </div>
        );
    }

    return (
        <div className="sahur-page flex flex-1 flex-col items-center justify-center px-5 py-12">
            <div className="sahur-panel w-full max-w-lg p-6 sm:p-9">
                <span className="sahur-eyebrow">One last little thing</span>
                <h1 className="mb-4 mt-3 text-4xl font-black tracking-tight">
                    Make yourself at home.
                </h1>
                <p className="mb-8 text-base leading-relaxed">
                    Add your first and last name to finish your lodge pass. The meme wall is waiting.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-2 text-sm font-bold">
                        First name
                        <input
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            autoComplete="given-name"
                            className="sahur-input"
                        />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-bold">
                        Last name
                        <input
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            autoComplete="family-name"
                            className="sahur-input"
                        />
                    </label>

                    {error && <p role="alert" className="rounded-xl border-2 border-red-800 bg-red-50 p-3 text-sm font-medium text-red-900">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="sahur-button mt-3 min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? 'Saving…' : 'Save and continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
