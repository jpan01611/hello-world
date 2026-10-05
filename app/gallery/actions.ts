'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateDescription, generateFunnyCaption } from '@/lib/groq';

const IMAGES_BUCKET = 'images';

// Server action: uploads the submitted file to Supabase Storage, then
// inserts a row (with the public URL) into the `images` table. This
// respects the project's RLS policies: only a logged-in user can insert,
// and `created_by` must match `auth.uid()`.
export async function uploadImageAction(formData: FormData) {
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
        throw new Error('Please choose an image file');
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(fileName, file);

    if (uploadError) {
        throw uploadError;
    }

    const { data: urlData } = supabase.storage
        .from(IMAGES_BUCKET)
        .getPublicUrl(fileName);

    const { error: dbError } = await supabase
        .from('images')
        .insert({
            created_by: user.id,
            image_url: urlData.publicUrl,
        });

    if (dbError) {
        throw dbError;
    }

    redirect('/gallery');
}

// Server action: records an image that's already hosted elsewhere (no
// Supabase Storage upload needed) by inserting its URL directly.
export async function uploadImageUrlAction(formData: FormData) {
    const imageUrl = formData.get('imageUrl');

    if (typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        throw new Error('Please enter an image URL');
    }

    let parsed: URL;
    try {
        parsed = new URL(imageUrl.trim());
    } catch {
        throw new Error('That doesn\'t look like a valid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('URL must start with http:// or https://');
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const { error: dbError } = await supabase
        .from('images')
        .insert({
            created_by: user.id,
            image_url: parsed.toString(),
        });

    if (dbError) {
        throw dbError;
    }

    redirect('/gallery');
}

// Server action: the "Crackd.ai" caption pipeline. Describes the uploaded
// image with Gemini, turns that description into a funny caption, and
// records both in the `captions` table.
export async function generateCaptionAction(imageId: string, imageUrl: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const description = await generateDescription(imageUrl);
    const caption = await generateFunnyCaption(description);

    const { error: dbError } = await supabase
        .from('captions')
        .insert({
            image_id: imageId,
            created_by: user.id,
            description,
            caption,
        });

    if (dbError) {
        throw dbError;
    }

    revalidatePath('/gallery');

    return { description, caption };
}

// Server action: toggles the current user's vote on a caption. Clicking the
// same direction again removes the vote; clicking the opposite direction
// flips it. Delegates to the `toggle_vote` Postgres function (see
// supabase/migrations/0005_toggle_vote_function.sql) so the read-then-write
// is atomic — two fast clicks can't both see "no existing vote" and race
// past the delete/undo branch.
export async function voteOnCaptionAction(captionId: string, value: 1 | -1) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const { error: rpcError } = await supabase.rpc('toggle_vote', {
        p_caption_id: captionId,
        p_value: value,
    });

    if (rpcError) {
        throw rpcError;
    }

    revalidatePath('/gallery');
}
