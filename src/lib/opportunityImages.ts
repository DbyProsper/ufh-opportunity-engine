// Default category-based images and helpers for opportunity visuals.
// Uses Unsplash featured photos served via their CDN — no storage costs.

export const CATEGORIES = [
  "tutor",
  "bursary",
  "internship",
  "workshop",
  "research",
  "scholarship",
  "job",
  "default",
] as const;

export type OpportunityCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  tutor: "Tutoring / Teaching",
  bursary: "Bursary / Funding",
  internship: "Internship",
  workshop: "Workshop / Seminar",
  research: "Research",
  scholarship: "Scholarship",
  job: "Job / Position",
  default: "General academic",
};

// Curated Unsplash photos (CDN, ~1200px, WebP-friendly via auto=format).
const DEFAULTS: Record<OpportunityCategory, string> = {
  tutor:       "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=70",
  bursary:     "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=70",
  internship:  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=70",
  workshop:    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=70",
  research:    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=70",
  scholarship: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=70",
  job:         "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=70",
  default:     "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=70",
};

export const DEFAULT_FALLBACK = DEFAULTS.default;

const KEYWORDS: Array<[OpportunityCategory, RegExp]> = [
  ["tutor",       /\b(tutor|tutoring|teaching|lecturer|assistant|TA)\b/i],
  ["bursary",     /\b(bursary|bursaries|funding|grant)\b/i],
  ["scholarship", /\b(scholarship|fellowship)\b/i],
  ["internship",  /\b(intern|internship|graduate program|vacation work)\b/i],
  ["workshop",    /\b(workshop|seminar|webinar|training|conference)\b/i],
  ["research",    /\b(research|postdoc|phd|masters|thesis|publication)\b/i],
  ["job",         /\b(position|vacancy|appointment|employment|recruit)\b/i],
];

export const inferCategory = (
  ...texts: Array<string | null | undefined>
): OpportunityCategory => {
  const haystack = texts.filter(Boolean).join(" ").toLowerCase();
  for (const [cat, re] of KEYWORDS) {
    if (re.test(haystack)) return cat;
  }
  return "default";
};

export const defaultImageFor = (category?: string | null): string => {
  const c = (category ?? "default") as OpportunityCategory;
  return DEFAULTS[c] ?? DEFAULTS.default;
};

export const resolveOpportunityImage = (opts: {
  image_url?: string | null;
  category?: string | null;
  name?: string | null;
  description?: string | null;
}): string => {
  if (opts.image_url && opts.image_url.trim()) return opts.image_url;
  const cat = opts.category ?? inferCategory(opts.name, opts.description);
  return defaultImageFor(cat);
};