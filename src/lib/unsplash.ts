import { OpportunityCategory, CATEGORY_LABELS } from "@/lib/opportunityImages";

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export const UNSPLASH_ENABLED = Boolean(ACCESS_KEY);

export const buildUnsplashQuery = (category?: OpportunityCategory | null, workflowName?: string | null) => {
  const categoryText = category ? CATEGORY_LABELS[category] : "Academic opportunity";
  const nameText = workflowName ? ` ${workflowName}` : "";
  return `${categoryText}${nameText}`;
};

export interface UnsplashPhotoResult {
  id: string;
  thumb: string;
  full: string;
  alt: string;
}

export const searchUnsplashPhotos = async (query: string, perPage = 6): Promise<UnsplashPhotoResult[]> => {
  if (!ACCESS_KEY) {
    throw new Error("Unsplash access key is not configured.");
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", String(perPage));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${ACCESS_KEY}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unsplash request failed: ${response.status} ${response.statusText} ${body}`);
  }

  const json = await response.json();

  return (json.results ?? []).map((photo: any) => ({
    id: photo.id,
    thumb: photo.urls?.small ?? photo.urls?.thumb,
    full: photo.urls?.regular ?? photo.urls?.full,
    alt: photo.alt_description || photo.description || "Unsplash image",
  }));
};
