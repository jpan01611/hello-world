'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const supabase = createClient();

    const [googleLoading, setGoogleLoading] = useState(false);

    async function loginWithGoogle() {
        setGoogleLoading(true);
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                // Force Google's account picker to show every time, even if
                // the browser already has a single active Google session.
                queryParams: { prompt: 'select_account' },
            },
        });
    }

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 font-sans dark:bg-black">
            <div className="w-full max-w-sm">
                <h1 className="mb-6 text-center text-2xl font-semibold text-black dark:text-zinc-50">
                    Sign in
                </h1>

                <button
                    onClick={loginWithGoogle}
                    disabled={googleLoading}
                    className="h-11 w-full rounded-full border border-black/15 text-black transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:text-zinc-50 dark:hover:bg-white/10"
                >
                    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                </button>
            </div>
        </div>
    );
}
