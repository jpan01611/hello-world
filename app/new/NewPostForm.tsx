'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { uploadImageAction, uploadImageUrlAction } from '@/app/_actions/posts';
import { UPLOAD_SIZE_HINT, uploadSizeError } from '@/lib/upload-limits';

type Mode = 'file' | 'url';

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" disabled={disabled || pending} className="sahur-button min-h-12">
            {pending ? 'Writing caption…' : 'Post to the wall'}
        </button>
    );
}

// Lets the user choose between uploading a photo file or pasting an image
// URL, and submits to the matching server action.
export function NewPostForm() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>('file');
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragDepth = useRef(0);

    async function submitUrl(formData: FormData) {
        setUploadError(null);
        try {
            const result = await uploadImageUrlAction(formData);
            if (result?.error) setUploadError(result.error);
        } catch (error) {
            const digest = error && typeof error === 'object' && 'digest' in error
                ? String(error.digest)
                : '';
            if (digest.startsWith('NEXT_REDIRECT')) {
                router.push('/');
                return;
            }
            setUploadError(error instanceof Error ? error.message : 'We couldn\'t post that photo URL.');
        }
    }

    async function submitFile(formData: FormData) {
        setUploadError(null);
        try {
            const result = await uploadImageAction(formData);
            if (result?.error) setUploadError(result.error);
        } catch (error) {
            const digest = error && typeof error === 'object' && 'digest' in error
                ? String(error.digest)
                : '';
            if (digest.startsWith('NEXT_REDIRECT')) {
                router.push('/');
                return;
            }
            setUploadError(error instanceof Error ? error.message : 'We couldn\'t post that photo.');
        }
    }

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
        setPreviewUrl(error || !file ? null : URL.createObjectURL(file));
        input.value = '';
        if (!error && file) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
        }
    }

    return (
        <div className="w-full">
            <div className="mb-6 rounded-xl bg-[#eadcc4] p-3">
                <div className={`upload-mode-switch ${mode === 'url' ? 'is-url' : ''}`}>
                    <span className={`upload-mode-option ${mode === 'file' ? 'is-active' : ''}`}>Upload a photo</span>
                    <span className={`upload-mode-option ${mode === 'url' ? 'is-active' : ''}`}>Post a photo link</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="1"
                    value={mode === 'file' ? 0 : 1}
                    aria-label="Choose upload method"
                    onChange={(event) => {
                        const nextMode = event.target.value === '0' ? 'file' : 'url';
                        setMode(nextMode);
                        if (nextMode === 'url') {
                            setFileName(null);
                            setPreviewUrl(null);
                            setUploadError(null);
                            setIsDragging(false);
                            dragDepth.current = 0;
                        }
                    }}
                    className="upload-mode-range"
                />
                </div>
                <p className="mt-2 text-center text-xs text-[#71523c]">Slide to choose how you want to add your photo</p>
            </div>

            {mode === 'file' ? (
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const file = fileInputRef.current?.files?.[0];
                    const error = file ? uploadSizeError(file) : null;
                    if (error || uploadError) {
                        setUploadError(error ?? uploadError);
                        return;
                    }
                    await submitFile(new FormData(e.currentTarget));
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
                        className={`relative flex flex-col items-center gap-4 rounded-2xl border-[3px] border-dashed border-[#68432d] px-5 py-8 text-center text-[#3b2419] transition-colors ${isDragging ? 'bg-[#d6ef73]' : 'bg-[#fff1d7]'}`}
                    >
                        {previewUrl && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewUrl(null);
                                    setFileName(null);
                                    setUploadError(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#493024] bg-[#fff9ec] text-lg font-black leading-none shadow-[2px_2px_0_#493024] hover:bg-[#ffae70]"
                                aria-label="Remove selected photo"
                            >
                                ×
                            </button>
                        )}
                        {fileName && <span aria-live="polite" className="w-full truncate text-sm">{fileName}</span>}
                        {!previewUrl && (
                            <>
                                <p className="text-lg font-black">One good photo. Endless possibilities.</p>
                                <p className="text-sm" aria-live="polite">{isDragging ? 'Drop your photo here!' : 'Drag an image here, or choose one below.'}</p>
                                <p className="max-w-md text-xs leading-relaxed text-[#71523c]">Best with JPG, PNG, GIF, or WebP photos of everyday life, campus moments, friends, pets, food, and places. {UPLOAD_SIZE_HINT}</p>
                            </>
                        )}
                        {previewUrl && <img src={previewUrl} alt="Selected photo preview" className="max-h-52 w-full rounded-xl border-2 border-[#bda487] object-contain" />}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="sahur-button-secondary min-h-11 text-sm"
                        >
                            {previewUrl ? 'Change photo' : 'Choose a photo'}
                        </button>
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
                    </div>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                        Add Columbia context for the caption (Optional)
                        <textarea
                            name="context"
                            rows={3}
                            maxLength={500}
                            placeholder="What should the AI know? E.g. Butler during midterms, a Core class, or a rainy walk near Columbia."
                            className="sahur-input resize-y"
                        />
                        <span className="font-normal text-[#71523c]">Mention your school, campus, neighborhood, or student routine for a more specific caption.</span>
                    </label>
                    {uploadError && <p role="alert" className="rounded-lg bg-[#ffe0cf] p-3 text-sm text-[#8d301a]">{uploadError}</p>}
                    <SubmitButton disabled={!!uploadError || !fileName} />
                </form>
            ) : (
                <form onSubmit={async (event) => {
                    event.preventDefault();
                    await submitUrl(new FormData(event.currentTarget));
                }} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-2 text-sm font-bold">
                        Photo URL
                        <input
                            type="url"
                            name="imageUrl"
                            placeholder="https://example.com/photo.jpg"
                            required
                            className="sahur-input"
                            aria-describedby="photo-url-hint"
                            onChange={() => setUploadError(null)}
                        />
                    </label>
                    <p id="photo-url-hint" className="text-sm leading-relaxed">
                        Paste a direct link to an image, not the page it lives on.
                    </p>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                        Add Columbia context for the caption (Optional)
                        <textarea
                            name="context"
                            rows={3}
                            maxLength={500}
                            placeholder="What should the AI know? E.g. a Columbia study break, Core class, or subway adventure."
                            className="sahur-input resize-y"
                        />
                        <span className="font-normal text-[#71523c]">Mention your school, campus, neighborhood, or student routine for a more specific caption.</span>
                    </label>
                    {uploadError && <p role="alert" className="rounded-lg bg-[#ffe0cf] p-3 text-sm text-[#8d301a]">{uploadError}</p>}
                    <SubmitButton />
                </form>
            )}
        </div>
    );
}
