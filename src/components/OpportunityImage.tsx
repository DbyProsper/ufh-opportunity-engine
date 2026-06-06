import { useState } from "react";
import { DEFAULT_FALLBACK, defaultImageFor, resolveOpportunityImage } from "@/lib/opportunityImages";

interface Props {
  image_url?: string | null;
  category?: string | null;
  name?: string | null;
  description?: string | null;
  className?: string;
  aspect?: "video" | "square" | "wide";
  alt?: string;
  priority?: boolean;
}

const aspectClass = {
  video: "aspect-video",
  square: "aspect-square",
  wide: "aspect-[21/9]",
};

export const OpportunityImage = ({
  image_url, category, name, description,
  className = "", aspect = "video", alt, priority = false,
}: Props) => {
  const initial = resolveOpportunityImage({ image_url, category, name, description });
  const [src, setSrc] = useState(initial);
  const [errored, setErrored] = useState(false);

  const handleError = () => {
    if (errored) return;
    setErrored(true);
    const fallback = defaultImageFor(category) || DEFAULT_FALLBACK;
    setSrc(fallback === src ? DEFAULT_FALLBACK : fallback);
  };

  return (
    <div className={`relative overflow-hidden bg-muted ${aspectClass[aspect]} ${className}`}>
      <img
        src={src}
        alt={alt ?? name ?? "Opportunity"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={handleError}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
      />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
};

export default OpportunityImage;