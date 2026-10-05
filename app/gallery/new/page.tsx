import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { NewPostForm } from './NewPostForm';

export default async function NewPostPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return (
        <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
            <div className="w-full max-w-sm">
                <Link href="/gallery" className="mb-4 inline-block text-sm text-blue-600 underline">
                    ← Back to gallery
                </Link>

                <h1 className="mb-6 text-center text-2xl font-semibold text-black dark:text-zinc-50">
                    New Post
                </h1>

                <NewPostForm />
            </div>
        </div>
    );
}
