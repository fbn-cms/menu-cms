// Client-safe (no Zod/server imports). Public URL of an R2 image key, served by /img/[...key].
// Relative on purpose: the host comes from wherever the page is served.
export const imageUrl = (key: string) => `/img/${key}`;
