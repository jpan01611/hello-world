'use client';

import { useRef, useState } from 'react';
import { uploadImageAction, uploadImageUrlAction } from '../actions';
import { UPLOAD_SIZE_HINT, uploadSizeError } from '@/lib/upload-limits';

type Mode = 'file' | 'url';

// Lets the user choose between uploading a photo file or pasting an image
// URL, and submits to the matching server action.
export function NewPostForm() {
    const [mode, setMode] = useState<Mode>('file');
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    return (
        <div className="w-full">
            <div role="group" aria-label="Choose how to add your photo" className="mb-6 grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setMode('file')}
                    aria-pressed={mode === 'file'}
                    className={`min-h-12 text-sm ${
                        mode === 'file'
                            ? 'sahur-button'
                            : 'sahur-button-secondary'
                    }`}
                >
                    Upload a file
                </button>
                <button
                    type="button"
                    onClick={() => setMode('url')}
                    aria-pressed={mode === 'url'}
                    className={`min-h-12 text-sm ${
                        mode === 'url'
                            ? 'sahur-button'
                            : 'sahur-button-secondary'
                    }`}
                >
                    Paste a link
                </button>
            </div>

            {mode === 'file' ? (
                <form action={uploadImageAction} onSubmit={(e) => {
                    const file = fileInputRef.current?.files?.[0];
                    const error = file ? uploadSizeError(file) : null;
                    if (error || uploadError) {
                        e.preventDefault();
                        setUploadError(error ?? uploadError);
                    }
                }} className="flex flex-col gap-4">
                    <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-dashed border-[#68432d] bg-[#fff1d7] px-5 py-8 text-center text-[#3b2419]">
                        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#3b2419] bg-[#d6ef73] text-3xl font-black">+</span>
                        <p className="text-lg font-black">One good photo. Endless possibilities.</p>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="sahur-button-secondary min-h-11 text-sm"
                        >
                            Choose a photo
                        </button>
                        <span aria-live="polite" className="w-full truncate text-sm">
                            {fileName ?? 'No file chosen'}
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            name="file"
                            accept="image/*"
                            aria-label="Photo to post"
                            required
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                const error = file ? uploadSizeError(file) : null;
                                setUploadError(error);
                                setFileName(error ? null : file?.name ?? null);
                                if (error) e.target.value = '';
                            }}
                        />
                        <p className="text-sm">{UPLOAD_SIZE_HINT}</p>
                    </div>
                    {uploadError && <p role="alert" className="rounded-lg bg-[#ffe0cf] p-3 text-sm text-[#8d301a]">{uploadError}</p>}
                    <button
                        type="submit"
                        disabled={!!uploadError}
                        className="sahur-button min-h-12"
                    >
                        Post to the wall
                    </button>
                </form>
            ) : (
                <form action={uploadImageUrlAction} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-2 text-sm font-bold">
                        Photo URL
                        <input
                            type="url"
                            name="imageUrl"
                            placeholder="https://example.com/photo.jpg"
                            required
                            className="sahur-input"
                            aria-describedby="photo-url-hint"
                        />
                    </label>
                    <p id="photo-url-hint" className="text-sm leading-relaxed">
                        Paste a direct link to an image, not the page it lives on.
                    </p>
                    <button
                        type="submit"
                        className="sahur-button min-h-12"
                    >
                        Post to the wall
                    </button>
                </form>
            )}
        </div>
    );
}
