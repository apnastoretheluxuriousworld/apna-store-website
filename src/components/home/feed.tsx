import { getStoreFeed } from "@/lib/data/feed";
import { FeedStrip } from "./feed-strip";

/**
 * Homepage "Our Feed": vertical 9:16 videos managed in Admin → Feed (cached
 * with the "feed" tag; admin actions refresh it). Hidden when empty.
 */
export async function Feed() {
  const videos = await getStoreFeed();
  if (!videos.length) return null;
  return <FeedStrip videos={videos} />;
}
