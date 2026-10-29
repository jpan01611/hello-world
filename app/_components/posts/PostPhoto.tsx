'use client';

import Image from 'next/image';
import { useState } from 'react';

const STORAGE_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
    : null;

function isAnimatedImage(src: string): boolean {
    try {
        const pathname = new URL(src).pathname.toLowerCase();
        return /\.(gif|apng|webp)$/.test(pathname);
    } catch {
        return /\.(gif|apng|webp)(?:$|[?#])/i.test(src);
    }
}

export function PostPhoto({ src, priority = false }: { src: string; priority?: boolean }) {
    const [dimensions, setDimensions] = useState<{ src: string; ratio: number } | null>(null);
    const ratio = dimensions?.src === src ? dimensions.ratio : null;
    const width = ratio !== null && ratio < 1 ? ratio * 100 : 100;
    const height = ratio !== null && ratio > 1 ? 100 / ratio : 100;
    const unoptimized = !STORAGE_PREFIX || !src.startsWith(STORAGE_PREFIX) || isAnimatedImage(src);

    return (
        <div className="relative aspect-square w-full">
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                    width: `${width}%`,
                    height: `${height}%`,
                    outline: ratio !== null ? '2px solid #bda487' : undefined,
                    outlineOffset: '-2px',
                }}
            >
                <Image
                    src={src}
                    alt="Posted photo"
                    fill
                    unoptimized={unoptimized}
                    loading={priority ? 'eager' : 'lazy'}
                    sizes="(max-width: 460px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-contain"
                    onLoad={(event) => {
                        const image = event.currentTarget;
                        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                            setDimensions({ src, ratio: image.naturalWidth / image.naturalHeight });
                        }
                    }}
                />
            </div>
        </div>
    );
}
