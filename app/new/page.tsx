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
        <div className="sahur-page flex flex-1 flex-col items-center px-5 py-12">
            <div className="w-full max-w-xl">
                <Link href="/" className="sahur-button-ghost mb-6 inline-flex">
                    ← Back to the meme wall
                </Link>

                <section className="sahur-panel p-6 sm:p-9">
                    <span className="sahur-eyebrow">Fresh fuel for the lodge</span>
                    <h1 className="mb-4 mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                        Drop a photo.
                    </h1>
                    <p className="mb-8 text-base leading-relaxed">
                        A weird find, a perfect reaction, a little everyday chaos. Give it a spot on the wall.
                    </p>

                    <NewPostForm />
                </section>
            </div>
        </div>
    );
}
