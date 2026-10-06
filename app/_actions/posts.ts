'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateDescription, generateFunnyCaption } from '@/lib/ai/captions';
import { uploadSizeError } from '@/lib/upload-limits';

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
    const sizeError = uploadSizeError(file);
    if (sizeError) throw new Error(sizeError);

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

    redirect('/');
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

    redirect('/');
}

// Server action: replaces an existing post's photo with a newly uploaded
// file or a pasted URL. RLS only allows this when `created_by` matches the
// caller, but we also filter by it here and check the affected row count so
// a non-owner gets a clear error instead of a silent no-op.
export async function updateImageAction(imageId: string, formData: FormData) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const file = formData.get('file');
    const imageUrlInput = formData.get('imageUrl');

    const { data: ownedImage, error: ownershipError } = await supabase
        .from('images')
        .select('id')
        .eq('id', imageId)
        .eq('created_by', user.id)
        .maybeSingle();
    if (ownershipError) throw ownershipError;
    if (!ownedImage) throw new Error('You can only edit your own posts');

    let newImageUrl: string;

    if (file instanceof File && file.size > 0) {
        const sizeError = uploadSizeError(file);
        if (sizeError) throw new Error(sizeError);
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

        newImageUrl = urlData.publicUrl;
    } else if (typeof imageUrlInput === 'string' && imageUrlInput.trim() !== '') {
        let parsed: URL;
        try {
            parsed = new URL(imageUrlInput.trim());
        } catch {
            throw new Error('That doesn\'t look like a valid URL');
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('URL must start with http:// or https://');
        }

        newImageUrl = parsed.toString();
    } else {
        throw new Error('Please choose a file or enter an image URL');
    }

    const { data: updated, error: dbError } = await supabase
        .from('images')
        .update({ image_url: newImageUrl })
        .eq('id', imageId)
        .eq('created_by', user.id)
        .select('id');

    if (dbError) {
        throw dbError;
    }

    if (!updated || updated.length === 0) {
        throw new Error('You can only edit your own posts');
    }

    revalidatePath('/');
}

// Server action: deletes a post. RLS (and the explicit `created_by` filter
// below) restrict this to the post's owner; captions and votes cascade-delete
// automatically via their foreign keys.
export async function deleteImageAction(imageId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const { data: deleted, error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId)
        .eq('created_by', user.id)
        .select('id');

    if (dbError) {
        throw dbError;
    }

    if (!deleted || deleted.length === 0) {
        throw new Error('You can only delete your own posts');
    }

    revalidatePath('/');
}

// Server action: the "Crackd.ai" caption pipeline. Describes the uploaded
// image with a vision model, turns that description into a funny caption, and
// records both in the `captions` table.
export async function generateCaptionAction(imageId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const { data: image, error: imageError } = await supabase
        .from('images')
        .select('image_url')
        .eq('id', imageId)
        .eq('created_by', user.id)
        .maybeSingle();
    if (imageError) throw imageError;
    if (!image) throw new Error('You can only generate captions for your own posts');

    const { description, prompt: visionPrompt } = await generateDescription(image.image_url);
    const { caption, prompt: captionPrompt } = await generateFunnyCaption(description);

    const { error: dbError } = await supabase
        .from('captions')
        .insert({
            image_id: imageId,
            created_by: user.id,
            description,
            caption,
            vision_prompt: visionPrompt,
            caption_prompt: captionPrompt,
        });

    if (dbError) {
        throw dbError;
    }

    revalidatePath('/');

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

    revalidatePath('/');
}
