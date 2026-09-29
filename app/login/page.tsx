'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    async function login() {
        setLoading(true);
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
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
                Sign in
            </h1>
            <button
                onClick={login}
                disabled={loading}
                className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
            >
                {loading ? 'Redirecting…' : 'Continue with Google'}
            </button>
        </div>
    );
}
