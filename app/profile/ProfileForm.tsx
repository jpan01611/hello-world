'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { UPLOAD_SIZE_HINT, uploadSizeError } from '@/lib/upload-limits';

const AVATARS_BUCKET = 'avatars';

// Only avatars hosted in our own Supabase Storage bucket (allowlisted in
// next.config.ts) can go through next/image's optimizer.
const SUPABASE_STORAGE_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
    : null;

export default function ProfileForm() {
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

        const sizeError = uploadSizeError(file);
        if (sizeError) {
            setAvatarError(sizeError);
            return;
        }
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
            <div className="sahur-page flex flex-1 items-center justify-center px-5 py-12">
                <p role="status" className="sahur-panel p-6 font-bold">Finding your lodge pass…</p>
            </div>
        );
    }

    return (
        <div className="sahur-page flex flex-1 flex-col items-center justify-center px-5 py-12">
            <div className="sahur-panel w-full max-w-lg p-6 sm:p-9">
                <Link href="/" className="sahur-button-ghost mb-6 inline-flex">
                    ← Back to the lodge
                </Link>
                <span className="sahur-eyebrow">Your little corner</span>
                <h1 className="mb-4 mt-3 text-4xl font-black tracking-tight">
                    Your lodge pass.
                </h1>
                <p className="mb-3 text-base leading-relaxed">
                    Hey, {firstName || email}! Freshen up your photo or put a name to the memes.
                </p>
                <p className="mb-8 break-all text-sm font-medium">
                    {email}
                </p>

                <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[#68432d] bg-[#edf5b4] p-4">
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt="Your avatar"
                            width={64}
                            height={64}
                            unoptimized={!(SUPABASE_STORAGE_PREFIX !== null && avatarUrl.startsWith(SUPABASE_STORAGE_PREFIX))}
                            className="h-20 w-20 rounded-2xl border-[3px] border-[#3b2419] object-cover shadow-[3px_3px_0_0_#3b2419]"
                        />
                    ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-[#3b2419] bg-[#fff1d7] text-3xl font-black text-[#3b2419] shadow-[3px_3px_0_0_#3b2419]">
                            {(firstName[0] ?? email[0] ?? '?').toUpperCase()}
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            aria-label="Choose your profile photo"
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        <p className="text-xs">{UPLOAD_SIZE_HINT}</p>
                        <button
                            type="button"
                            disabled={uploadingAvatar}
                            onClick={() => fileInputRef.current?.click()}
                            className="sahur-button-secondary min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                        </button>
                        {avatarError && <p role="alert" className="mt-2 text-sm font-medium text-red-900">{avatarError}</p>}
                    </div>
                </div>

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
                    {success && <p role="status" className="rounded-xl border-2 border-[#526126] bg-[#edf5b4] p-3 text-sm font-bold text-[#344018]">{success}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="sahur-button mt-3 min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? 'Saving…' : 'Save changes'}
                    </button>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="sahur-button-secondary min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                </form>
            </div>
        </div>
    );
}
