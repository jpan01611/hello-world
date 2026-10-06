'use client';

import { useState } from 'react';
import Link from 'next/link';
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
        <div className="sahur-page flex flex-1 flex-col items-center justify-center px-5 py-12">
            <div className="w-full max-w-lg">
                <Link href="/" className="sahur-button-ghost mb-6 inline-flex">
                    ← Back to the lodge
                </Link>
                <section className="sahur-panel p-6 sm:p-9">
                    <span className="sahur-eyebrow">Members of the meme lodge</span>
                    <h1 className="mb-4 mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                        Come on in.
                    </h1>
                    <p className="mb-8 text-base leading-relaxed">
                        A cozy corner for your funniest finds. Sign in to drop a photo and join the good chaos.
                    </p>

                    <button
                        onClick={loginWithGoogle}
                        disabled={googleLoading}
                        className="sahur-button min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                    </button>
                    <p className="mt-5 text-sm leading-relaxed">
                        First visit? Continuing with Google creates your account.
                    </p>
                </section>
            </div>
        </div>
    );
}
