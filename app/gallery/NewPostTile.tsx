import Link from 'next/link';

// Grid tile that looks like an empty slot with a big "+" icon, linking to
// the dedicated "new post" page where the user picks upload-file or
// paste-URL.
export function NewPostTile() {
    return (
        <Link
            href="/gallery/new"
            className="pressable flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-white text-zinc-400 transition-colors hover:border-black/30 hover:bg-black/5 hover:text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-white/30 dark:hover:bg-white/5 dark:hover:text-zinc-300"
        >
            <span className="text-6xl font-light leading-none">+</span>
            <span className="text-xs font-medium">New Post</span>
        </Link>
    );
}
