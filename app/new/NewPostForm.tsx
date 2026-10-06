'use client';

import { useRef, useState } from 'react';
import { uploadImageAction, uploadImageUrlAction } from '@/app/_actions/posts';
import { UPLOAD_SIZE_HINT, uploadSizeError } from '@/lib/upload-limits';

type Mode = 'file' | 'url';

// Lets the user choose between uploading a photo file or pasting an image
// URL, and submits to the matching server action.
export function NewPostForm() {
    const [mode, setMode] = useState<Mode>('file');
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragDepth = useRef(0);

    function selectFiles(files: FileList | null) {
        const input = fileInputRef.current;
        if (!input) return;
        const file = files?.[0];
        const error = files && files.length > 1
            ? 'Please drop one image at a time.'
            : file && !file.type.startsWith('image/')
                ? 'Please choose an image file, such as JPG, PNG, GIF, or WebP.'
                : file ? uploadSizeError(file) : 'Please choose an image file.';
        setUploadError(error);
        setFileName(error ? null : file?.name ?? null);
        input.value = '';
        if (!error && file) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
        }
    }

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
                    onClick={() => {
                        setMode('url');
                        setFileName(null);
                        setUploadError(null);
                        setIsDragging(false);
                        dragDepth.current = 0;
                    }}
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
                    <div
                        onDragEnter={(e) => {
                            e.preventDefault();
                            dragDepth.current++;
                            setIsDragging(true);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            dragDepth.current = Math.max(0, dragDepth.current - 1);
                            if (dragDepth.current === 0) setIsDragging(false);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            dragDepth.current = 0;
                            setIsDragging(false);
                            selectFiles(e.dataTransfer.files);
                        }}
                        className={`flex flex-col items-center gap-4 rounded-2xl border-[3px] border-dashed border-[#68432d] px-5 py-8 text-center text-[#3b2419] transition-colors ${isDragging ? 'bg-[#d6ef73]' : 'bg-[#fff1d7]'}`}
                    >
                        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#3b2419] bg-[#d6ef73] text-3xl font-black">+</span>
                        <p className="text-lg font-black">One good photo. Endless possibilities.</p>
                        <p className="text-sm" aria-live="polite">{isDragging ? 'Drop your photo here!' : 'Drag an image here, or choose one below.'}</p>
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
                                selectFiles(e.target.files);
                            }}
                        />
                        <p className="text-sm">{UPLOAD_SIZE_HINT}</p>
                    </div>
                    {uploadError && <p role="alert" className="rounded-lg bg-[#ffe0cf] p-3 text-sm text-[#8d301a]">{uploadError}</p>}
                    <button
                        type="submit"
                        disabled={!!uploadError || !fileName}
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
