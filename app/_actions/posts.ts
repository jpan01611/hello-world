'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateDescription, generateFunnyCaption } from '@/lib/ai/captions';
import { uploadSizeError } from '@/lib/upload-limits';

const IMAGES_BUCKET = 'images';
const MAX_CONTEXT_LENGTH = 500;

async function generateCaptionForImage(
    supabase: Awaited<ReturnType<typeof createClient>>,
    imageId: string,
    imageUrl: string,
    context: string | null,
    userId: string,
) {
    const { description, prompt: visionPrompt } = await generateDescription(imageUrl, context);
    const { caption, prompt: captionPrompt } = await generateFunnyCaption(description, context);
    const { error } = await supabase.from('captions').insert({
        image_id: imageId,
        created_by: userId,
        description,
        caption,
        vision_prompt: visionPrompt,
        caption_prompt: captionPrompt,
    });
    if (error) throw error;
}

// Server action: uploads the submitted file to Supabase Storage, then
// inserts a row (with the public URL) into the `images` table. This
// respects the project's RLS policies: only a logged-in user can insert,
// and `created_by` must match `auth.uid()`.
export async function uploadImageAction(formData: FormData) {
    const file = formData.get('file');
    const context = formData.get('context');

    if (!(file instanceof File) || file.size === 0) {
        throw new Error('Please choose an image file');
    }
    if (!file.type.startsWith('image/')) {
        throw new Error('Please choose a JPG, PNG, GIF, or WebP image');
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

    const { data: image, error: dbError } = await supabase
        .from('images')
        .insert({
            created_by: user.id,
            image_url: urlData.publicUrl,
            context: typeof context === 'string' ? context.trim() || null : null,
        })
        .select('id')
        .single();

    if (dbError) {
        throw dbError;
    }

    await generateCaptionForImage(supabase, image.id, urlData.publicUrl, typeof context === 'string' ? context.trim() || null : null, user.id);
    redirect('/');
}

// Server action: records an image that's already hosted elsewhere (no
// Supabase Storage upload needed) by inserting its URL directly.
export async function uploadImageUrlAction(formData: FormData) {
    const imageUrl = formData.get('imageUrl');
    const context = formData.get('context');

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

    const { data: image, error: dbError } = await supabase
        .from('images')
        .insert({
            created_by: user.id,
            image_url: parsed.toString(),
            context: typeof context === 'string' ? context.trim() || null : null,
        })
        .select('id')
        .single();

    if (dbError) {
        throw dbError;
    }

    await generateCaptionForImage(supabase, image.id, parsed.toString(), typeof context === 'string' ? context.trim() || null : null, user.id);
    redirect('/');
}

export async function updateImageContextAction(imageId: string, formData: FormData) {
    const context = formData.get('context');

    if (typeof context !== 'string') {
        throw new Error('Please enter valid context');
    }

    const trimmedContext = context.trim();
    if (trimmedContext.length > MAX_CONTEXT_LENGTH) {
        throw new Error(`Context must be ${MAX_CONTEXT_LENGTH} characters or fewer`);
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const { data: updated, error: dbError } = await supabase
        .from('images')
        .update({ context: trimmedContext || null })
        .eq('id', imageId)
        .eq('created_by', user.id)
        .select('id');

    if (dbError) {
        throw dbError;
    }

    if (!updated || updated.length === 0) {
        throw new Error('You can only edit context on your own posts');
    }

    revalidatePath('/');
    revalidatePath('/dashboard');
}

export async function selectFeaturedCaptionAction(imageId: string, captionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not logged in');

    const { error } = await supabase
        .from('images')
        .update({ selected_caption_id: captionId })
        .eq('id', imageId)
        .eq('created_by', user.id);
    if (error) throw error;
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

// Server action: deletes a caption and its votes. The ownership filter mirrors
// the captions RLS policy so callers cannot remove another user's caption.
export async function deleteCaptionAction(captionId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not logged in');
    }

    const { data: deleted, error: dbError } = await supabase
        .from('captions')
        .delete()
        .eq('id', captionId)
        .eq('created_by', user.id)
        .select('id');

    if (dbError) {
        throw dbError;
    }

    if (!deleted || deleted.length === 0) {
        throw new Error('You can only delete your own captions');
    }

    revalidatePath('/');
    revalidatePath('/dashboard');
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
        .select('image_url, context')
        .eq('id', imageId)
        .eq('created_by', user.id)
        .maybeSingle();
    if (imageError) throw imageError;
    if (!image) throw new Error('You can only generate captions for your own posts');

    const { description, prompt: visionPrompt } = await generateDescription(image.image_url, image.context);
    const { caption, prompt: captionPrompt } = await generateFunnyCaption(description, image.context);

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
