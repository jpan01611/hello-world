'use client';

import { useRef, useState } from 'react';
import { uploadImageAction, uploadImageUrlAction } from '../actions';

type Mode = 'file' | 'url';

// Lets the user choose between uploading a photo file or pasting an image
// URL, and submits to the matching server action.
export function NewPostForm() {
    const [mode, setMode] = useState<Mode>('file');
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="w-full">
            <div className="mb-6 flex rounded-full border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-900">
                <button
                    type="button"
                    onClick={() => setMode('file')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        mode === 'file'
                            ? 'bg-foreground text-background'
                            : 'text-black hover:bg-black/5 dark:text-zinc-50 dark:hover:bg-white/10'
                    }`}
                >
                    Upload Photo
                </button>
                <button
                    type="button"
                    onClick={() => setMode('url')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        mode === 'url'
                            ? 'bg-foreground text-background'
                            : 'text-black hover:bg-black/5 dark:text-zinc-50 dark:hover:bg-white/10'
                    }`}
                >
                    Upload Photo URL
                </button>
            </div>

            {mode === 'file' ? (
                <form action={uploadImageAction} className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 rounded-full border border-black/15 py-2 pl-2 pr-4 text-sm text-black dark:border-white/20 dark:text-zinc-50">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="pressable rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
                        >
                            Choose File
                        </button>
                        <span className="truncate text-zinc-500 dark:text-zinc-400">
                            {fileName ?? 'No file chosen'}
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            name="file"
                            accept="image/*"
                            required
                            className="hidden"
                            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="h-11 rounded-full bg-foreground text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                    >
                        Post
                    </button>
                </form>
            ) : (
                <form action={uploadImageUrlAction} className="flex flex-col gap-4">
                    <input
                        type="url"
                        name="imageUrl"
                        placeholder="https://example.com/photo.jpg"
                        required
                        className="h-11 rounded-full border border-black/15 px-4 text-sm text-black dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                    <button
                        type="submit"
                        className="h-11 rounded-full bg-foreground text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                    >
                        Post
                    </button>
                </form>
            )}
        </div>
    );
}
