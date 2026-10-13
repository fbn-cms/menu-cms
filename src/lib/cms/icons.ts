// Icon catalogue for tags/labels (lucide names) + automatic suggestion from the label text.
// Used by the tag editor (suggest + picker) and by <TagIcon> on public pages.

export const ICON_NAMES = [
  "leaf",
  "vegan",
  "sprout",
  "carrot",
  "salad",
  "badge-check",
  "wheat-off",
  "wheat",
  "milk",
  "milk-off",
  "egg",
  "egg-off",
  "nut",
  "nut-off",
  "fish",
  "fish-off",
  "shell",
  "bean",
  "circle-dot",
  "flame",
  "snowflake",
  "chef-hat",
  "star",
  "sparkles",
  "award",
  "heart",
  "baby",
  "clock",
  "beef",
  "drumstick",
  "ham",
  "soup",
  "cooking-pot",
  "cake",
  "cookie",
  "ice-cream-cone",
  "candy",
  "cherry",
  "citrus",
  "apple",
  "grape",
  "coffee",
  "cup-soda",
  "wine",
  "beer",
  "utensils",
  "tag",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

// Ordered: first match wins. Keywords in English, French and Persian.
const RULES: [RegExp, IconName][] = [
  [/vegan|végétal|végane|وگان/i, "vegan"],
  [/vegetarian|végétarien|veggie|گیاهی/i, "carrot"],
  [/gluten.?free|sans gluten|بدون گلوتن/i, "wheat-off"],
  [/gluten|wheat|blé|گلوتن|گندم/i, "wheat"],
  [/lactose.?free|dairy.?free|sans lactose|بدون لبنیات/i, "milk-off"],
  [/dairy|milk|lait|lactose|cheese|fromage|لبنیات|شیر|پنیر/i, "milk"],
  [/egg.?free|sans œuf|sans oeuf/i, "egg-off"],
  [/egg|œuf|oeuf|تخم/i, "egg"],
  [/nut.?free|sans noix/i, "nut-off"],
  [
    /peanut|tree nut|nut|noix|arachide|amande|almond|pistach|مغز|بادام|گردو|پسته|بادام‌زمینی/i,
    "nut",
  ],
  [/shellfish|crustac|shrimp|crevette|mollus|صدف|میگو/i, "shell"],
  [/fish|poisson|ماهی/i, "fish"],
  [/soy|soja|سویا/i, "bean"],
  [/sesame|sésame|کنجد/i, "circle-dot"],
  [/halal|حلال/i, "badge-check"],
  [/spicy|hot|épicé|piquant|chili|تند/i, "flame"],
  [/cold|frozen|glacé|سرد/i, "snowflake"],
  [/chef|signature|house special|سرآشپز/i, "chef-hat"],
  [/new|nouveau|جدید/i, "sparkles"],
  [/popular|best.?seller|favou?rite|populaire|محبوب/i, "star"],
  [/award|prize|prix/i, "award"],
  [/healthy|light|léger|سالم/i, "heart"],
  [/kid|child|enfant|کودک/i, "baby"],
  [/quick|fast|rapide|سریع/i, "clock"],
  [/organic|bio|ارگانیک/i, "sprout"],
  [/alcohol|wine|vin|شراب/i, "wine"],
  [/beer|bière|آبجو/i, "beer"],
  [/coffee|café|قهوه/i, "coffee"],
  [/beef|bœuf|گوساله|گوشت/i, "beef"],
  [/chicken|poulet|مرغ|جوجه/i, "drumstick"],
  [/pork|porc/i, "ham"],
  [/dessert|sweet|sucré|شیرین|دسر/i, "cake"],
  [/soup|soupe|سوپ|آش/i, "soup"],
];

export function suggestIcon(label: string): IconName | null {
  const text = label.trim();
  if (!text) return null;
  return RULES.find(([re]) => re.test(text))?.[1] ?? null;
}

export const isIconName = (v: unknown): v is IconName =>
  typeof v === "string" && (ICON_NAMES as readonly string[]).includes(v);
