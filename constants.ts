
export const BASE_URL_SOUNDS = process.env.NEXT_PUBLIC_BACKEND !== undefined ? 
    process.env.NEXT_PUBLIC_BACKEND + '/static/sounds' : '';

export const BASE_URL_IMAGES = process.env.NEXT_PUBLIC_BACKEND !== undefined ? 
    process.env.NEXT_PUBLIC_BACKEND + '/static/images' : '';

export const ADMIN_PROFILE = 1;

// Absolute URLs (Cloudinary) are used as-is; legacy relative paths are
// resolved against the old static host.
export const resolveAvatarUrl = (src: string) =>
    /^https?:\/\//.test(src) ? src : `${BASE_URL_IMAGES}/users/${src}`;

// Sentence narrations have no URL column in the DB: they live under the
// deterministic public_id dots/sounds/sentences/<id> in Cloudinary (see
// dots-backend/scripts/migrate-media-to-cloudinary.js). Without the env var
// we fall back to the legacy relative path resolved against BASE_URL_SOUNDS.
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
// voiceKey: narration character subfolder (dots-backend characters.key). The
// default character (Doty) keeps the legacy path and sends no voice_key.
export const resolveSentenceSoundUrl = (
    id: number | string,
    ext: string,
    voiceKey?: string,
) => {
    const segment = voiceKey ? `${voiceKey}/` : "";
    return CLOUDINARY_CLOUD_NAME !== undefined
        ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/dots/sounds/sentences/${segment}${id}.${ext}`
        : `sentences/${segment}${id}.${ext}`;
};
