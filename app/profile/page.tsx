'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const AVATAR_BUCKET = 'avatars';

export default function ProfilePage() {
    const router = useRouter();
    const supabase = createClient();

    const [userId, setUserId] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

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

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (!userId) {
            setLoading(false);
            return;
        }

        let newAvatarUrl = avatarUrl;

        // Upload the photo to Supabase Storage and keep only the public URL
        // in the database - never store the binary image data in a table.
        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from(AVATAR_BUCKET)
                .upload(filePath, avatarFile, { upsert: true });

            if (uploadError) {
                setError(uploadError.message);
                setLoading(false);
                return;
            }

            const { data: publicUrlData } = supabase.storage
                .from(AVATAR_BUCKET)
                .getPublicUrl(filePath);

            newAvatarUrl = publicUrlData.publicUrl;
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                avatar_url: newAvatarUrl,
            })
            .eq('id', userId);

        setLoading(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }

        setAvatarUrl(newAvatarUrl);
        setAvatarFile(null);
        setSuccess('Profile updated!');
        router.refresh();
    }

    async function handleSignOut() {
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
                <h1 className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
                    Your profile
                </h1>
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {email}
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={avatarUrl}
                                alt="Profile photo"
                                className="h-16 w-16 rounded-full object-cover"
                            />
                        ) : (
                            <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                            className="text-sm text-black dark:text-zinc-50"
                        />
                    </div>

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
                        className="h-11 rounded-full border border-black/15 text-black transition-colors hover:bg-black/5 dark:border-white/20 dark:text-zinc-50 dark:hover:bg-white/10"
                    >
                        Sign out
                    </button>
                </form>
            </div>
        </div>
    );
}
