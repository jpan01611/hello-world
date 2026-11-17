'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

type PopoverPosition = { top: number; left: number };

export function SharePostButton({ imageId }: { imageId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
    const [shareUrl, setShareUrl] = useState(`/posts/${imageId}`);
    const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
    const postRef = useRef<Element | null>(null);

    function getPopoverPosition(post: Element): PopoverPosition {
        const bounds = post.getBoundingClientRect();
        const popoverWidth = Math.min(380, window.innerWidth - 32);
        const estimatedHeight = 190;
        const left = Math.max(
            16,
            Math.min(
                bounds.left + (bounds.width - popoverWidth) / 2,
                window.innerWidth - popoverWidth - 16,
            ),
        );
        const top = Math.max(
            16,
            Math.min(
                bounds.top + (bounds.height - estimatedHeight) / 2,
                window.innerHeight - estimatedHeight - 16,
            ),
        );
        return { top, left };
    }

    useEffect(() => {
        if (!isOpen) return;

        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false);
        }

        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        function reposition() {
            const post = postRef.current;
            if (!post) return;
            setPosition(getPopoverPosition(post));
        }

        reposition();
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [isOpen]);

    function openShareDialog(event: React.MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        const post = event.currentTarget.closest('.sahur-post');
        if (!post) return;
        postRef.current = post;
        setPosition(getPopoverPosition(post));
        setStatus('idle');
        setShareUrl(new URL(`/posts/${imageId}`, window.location.origin).toString());
        setIsOpen(true);
    }

    async function copyLink(event: React.MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        try {
            await navigator.clipboard.writeText(shareUrl);
            setStatus('copied');
        } catch {
            setStatus('error');
        }
    }

    function closeShareDialog(event: React.MouseEvent<HTMLElement>) {
        event.stopPropagation();
        setIsOpen(false);
    }

    return (
        <>
            <button
                type="button"
                onClick={openShareDialog}
                className="sahur-button-secondary sahur-caption-delete"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                Share post
            </button>
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-50" role="presentation" onClick={closeShareDialog}>
                    <div
                        className="sahur-panel absolute w-[calc(100vw-2rem)] max-w-[380px]"
                        style={{ top: position.top, left: position.left }}
                        role="dialog"
                        aria-modal="false"
                        aria-labelledby={`share-title-${imageId}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="sahur-eyebrow">Share this post</p>
                                <h2 id={`share-title-${imageId}`} className="mt-1 text-2xl font-black">Copy the post link</h2>
                            </div>
                            <button type="button" className="sahur-button-ghost sahur-caption-delete" onClick={closeShareDialog} aria-label="Close share dialog">×</button>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border-2 border-[#493024] bg-white p-2">
                            <input className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none" value={shareUrl} readOnly aria-label="Post link" />
                            <button type="button" className="sahur-button-secondary p-3" onClick={copyLink} aria-label="Copy post link" title="Copy post link">
                                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="11" height="11" rx="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                            </button>
                        </div>
                        <p className="mt-3 min-h-5 text-sm font-bold text-[#71523c]" role="status">{status === 'copied' ? 'Link copied!' : status === 'error' ? 'Copy failed. Select the link and copy it manually.' : ''}</p>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
