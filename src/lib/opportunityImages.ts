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

const SEARCH_QUERIES: Record<OpportunityCategory, string> = {
  tutor: "tutoring classroom learning",
  bursary: "student funding bursary scholarship",
  internship: "internship workplace student professional",
  workshop: "workshop seminar training conference",
  research: "research lab study university",
  scholarship: "scholarship award funding education",
  job: "job opening career office work",
  default: "university students campus learning",
};

const STATIC_SUGGESTIONS: Record<OpportunityCategory, Array<{ url: string; label: string }>> = {
  tutor: [
    { url: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=1200&q=70", label: "Group teaching" },
    { url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=70", label: "Study session" },
    { url: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?auto=format&fit=crop&w=1200&q=70", label: "Classroom interaction" },
    { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=70", label: "Teaching moment" },
  ],
  bursary: [
    { url: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1200&q=70", label: "Finance support" },
    { url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=70", label: "Scholarship award" },
    { url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=70", label: "Money planning" },
    { url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=70", label: "Student funding" },
  ],
  internship: [
    { url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=70", label: "Intern workspace" },
    { url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=1200&q=70", label: "Startup office" },
    { url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=70", label: "Professional development" },
    { url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=70", label: "Team brainstorming" },
  ],
  workshop: [
    { url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=70", label: "Workshop session" },
    { url: "https://images.unsplash.com/photo-1581092795361-2c6341c435fa?auto=format&fit=crop&w=1200&q=70", label: "Group training" },
    { url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=70", label: "Conference style" },
    { url: "https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?auto=format&fit=crop&w=1200&q=70", label: "Hands-on learning" },
  ],
  research: [
    { url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=70", label: "Lab research" },
    { url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=70", label: "Academic study" },
    { url: "https://images.unsplash.com/photo-1554475901-4538ddfbccc3?auto=format&fit=crop&w=1200&q=70", label: "Research notes" },
    { url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=70", label: "Scientific work" },
  ],
  scholarship: [
    { url: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1200&q=70", label: "Scholarship" },
    { url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=70", label: "Student finance" },
    { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=70", label: "Graduation support" },
    { url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=70", label: "Award event" },
  ],
  job: [
    { url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=70", label: "Job interview" },
    { url: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1200&q=70", label: "Office career" },
    { url: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=70", label: "Hiring" },
    { url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=70", label: "Professional team" },
  ],
  default: [
    { url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=70", label: "Student funding" },
    { url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=70", label: "Study space" },
    { url: "https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=1200&q=70", label: "Campus life" },
    { url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=70", label: "Learning together" },
  ],
};

export const staticImageSuggestions = (category?: string | null) => {
  const c = (category ?? "default") as OpportunityCategory;
  return STATIC_SUGGESTIONS[c] ?? STATIC_SUGGESTIONS.default;
};

export const categorySearchQuery = (category?: string | null, workflowName?: string | null) => {
  const c = (category ?? "default") as OpportunityCategory;
  const base = SEARCH_QUERIES[c] ?? SEARCH_QUERIES.default;
  return workflowName ? `${workflowName} ${base}` : base;
};