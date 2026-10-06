import Link from 'next/link';

// Grid tile that looks like an empty slot with a big "+" icon, linking to
// the dedicated "new post" page where the user picks upload-file or
// paste-URL.
export function NewPostTile() {
    return (
        <Link
            href="/new"
            className="group flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-[1.75rem] border-[3px] border-dashed border-[#68432d] bg-[#fff1d7] p-5 text-center text-[#3b2419] shadow-[inset_0_0_0_5px_#ead5b2,4px_4px_0_0_#68432d] transition-[transform,background-color,box-shadow] hover:-translate-y-1 hover:bg-[#edf5b4] hover:shadow-[inset_0_0_0_5px_#d8e692,6px_6px_0_0_#68432d] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#3b2419] active:translate-y-0 motion-reduce:transition-none"
        >
            <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[#3b2419] bg-[#ff8a3d] text-5xl font-black leading-none shadow-[3px_3px_0_0_#3b2419]">+</span>
            <span className="text-xl font-black tracking-tight">Drop a photo</span>
            <span className="text-sm font-medium">This spot has your name on it.</span>
        </Link>
    );
}
