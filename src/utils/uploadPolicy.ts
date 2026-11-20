/**
 * What users may upload, in one place. Files go straight from the browser to
 * Supabase through presigned URLs, so the server never sees them: it decides
 * the type and the file extension here (never trusting the client's string),
 * and the buckets enforce size and MIME type on the actual upload.
 */

const MB = 1024 * 1024;

/** MIME type → file extension, for images people can upload anywhere. */
export const IMAGE_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

/** MIME type → file extension, for voice notes. */
export const AUDIO_TYPES: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
};

export type ChatUploadKind = 'image' | 'audio';

export const CHAT_UPLOAD_RULES: Record<ChatUploadKind, { folder: string; maxBytes: number; types: Record<string, string> }> = {
    image: { folder: 'images', maxBytes: 5 * MB, types: IMAGE_TYPES },
    audio: { folder: 'audio', maxBytes: 2 * MB, types: AUDIO_TYPES },
};

export const IMAGE_MAX_BYTES = 5 * MB;

/** "audio/webm;codecs=opus" → "audio/webm". */
export function normalizeContentType(contentType: unknown): string {
    return typeof contentType === 'string' ? contentType.split(';')[0].trim().toLowerCase() : '';
}

/** The extension the server will use for this type, or null if the type isn't allowed. */
export function extensionFor(contentType: unknown, allowed: Record<string, string>): string | null {
    return allowed[normalizeContentType(contentType)] ?? null;
}

/** Which chat upload kind a content type belongs to, if any. */
export function chatUploadKind(contentType: unknown): ChatUploadKind | null {
    const type = normalizeContentType(contentType);
    if (type in IMAGE_TYPES) return 'image';
    if (type in AUDIO_TYPES) return 'audio';
    return null;
}
