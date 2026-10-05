'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

const AVATARS_BUCKET = 'avatars';

// Only avatars hosted in our own Supabase Storage bucket (allowlisted in
// next.config.ts) can go through next/image's optimizer.
const SUPABASE_STORAGE_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
    : null;

export default function ProfilePage() {
    const router = useRouter();
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [userId, setUserId] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/login');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, avatar_url')
                .eq('id', user.id)
                .single();

            setUserId(user.id);
            setEmail(user.email ?? '');
            setFirstName(profile?.first_name ?? '');
            setLastName(profile?.last_name ?? '');
            setAvatarUrl(profile?.avatar_url ?? null);
            setChecking(false);
        }

        load();
    }, [router, supabase]);

    async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file || !userId) return;

        setAvatarError(null);
        setUploadingAvatar(true);

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from(AVATARS_BUCKET)
            .upload(fileName, file);

        if (uploadError) {
            setUploadingAvatar(false);
            setAvatarError(uploadError.message);
            return;
        }

        const { data: urlData } = supabase.storage
            .from(AVATARS_BUCKET)
            .getPublicUrl(fileName);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: urlData.publicUrl })
            .eq('id', userId);

        setUploadingAvatar(false);

        if (updateError) {
            setAvatarError(updateError.message);
            return;
        }

        setAvatarUrl(urlData.publicUrl);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (!userId) {
            setLoading(false);
            return;
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
            })
            .eq('id', userId);

        setLoading(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }

        setSuccess('Profile updated!');
        router.refresh();
    }

    async function handleSignOut() {
        if (signingOut) return;
        setSigningOut(true);
        await supabase.auth.signOut();
        router.replace('/login');
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
        <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
            <div className="w-full max-w-sm">
                <Link href="/" className="mb-4 inline-block text-sm text-blue-600 underline">
                    ← Back to home
                </Link>
                <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
                    Your profile
                </h1>
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {email}
                </p>

                <div className="mb-6 flex items-center gap-4">
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt="Your avatar"
                            width={64}
                            height={64}
                            unoptimized={!(SUPABASE_STORAGE_PREFIX !== null && avatarUrl.startsWith(SUPABASE_STORAGE_PREFIX))}
                            className="h-16 w-16 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {(firstName[0] ?? email[0] ?? '?').toUpperCase()}
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        <button
                            type="button"
                            disabled={uploadingAvatar}
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-full border border-black/15 px-4 py-1.5 text-xs text-black transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:text-zinc-50 dark:hover:bg-white/10"
                        >
                            {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                        </button>
                        {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
                    </div>
                </div>

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
                    {success && <p className="text-sm text-green-600">{success}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 h-11 rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
                    >
                        {loading ? 'Saving…' : 'Save changes'}
                    </button>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="h-11 rounded-full border border-black/15 text-black transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:text-zinc-50 dark:hover:bg-white/10"
                    >
                        {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                </form>
            </div>
        </div>
    );
}
