/**
 * Product galleries hold photos and videos in one ordered list. A video is
 * recognised by its file extension (uploads are always named by type, e.g.
 * products/2026/11/<uuid>.mp4), so no separate "kind" column is needed.
 */
export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"] as const;

const videoRe = new RegExp(`\\.(${VIDEO_EXTENSIONS.join("|")})(?:[?#]|$)`, "i");

export const isVideoUrl = (url: string) => videoRe.test(url);

/** Same rule for Postgres (`~*` = case-insensitive regex match). */
export const VIDEO_URL_PG_REGEX = `\\.(${VIDEO_EXTENSIONS.join("|")})([?#]|$)`;

/** First photo in a gallery: the cover for cards and lists (videos can't be one). */
export const coverOf = <T extends { url: string }>(items: T[]) => items.find((i) => !isVideoUrl(i.url));

export const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/avif";
export const ACCEPT_VIDEOS = "video/mp4,video/webm,video/quicktime";
