// Fixed terms for the translator: Persian dishes/ingredients and words the model got wrong in
// testing (e.g. barberries → elderberries, "spiced" → "spicy-hot"). English → [Persian, French].
// Extend this list as the menu grows; it costs only a few input tokens per request.
export const GLOSSARY: Record<string, [fa: string, fr: string]> = {
  Tahchin: ["ته‌چین", "Tahchin (gâteau de riz au safran)"],
  Koobideh: ["کوبیده", "Koobideh"],
  Joojeh: ["جوجه", "Joojeh"],
  Barg: ["برگ", "Barg"],
  "Ghormeh Sabzi": ["قورمه‌سبزی", "Ghormeh sabzi"],
  Gheimeh: ["قیمه", "Gheimeh"],
  Fesenjan: ["فسنجان", "Fesenjan"],
  "Kashk-e Bademjan": ["کشک بادمجان", "Kashk-e bademjan"],
  "Mirza Ghasemi": ["میرزاقاسمی", "Mirza ghasemi"],
  Tahdig: ["ته‌دیگ", "Tahdig (riz croustillant)"],
  "Zereshk Polo": ["زرشک‌پلو", "Zereshk polo"],
  "Baghali Polo": ["باقالی‌پلو", "Baghali polo"],
  "Sabzi Polo": ["سبزی‌پلو", "Sabzi polo"],
  "Ash Reshteh": ["آش رشته", "Ash reshteh"],
  Dizi: ["دیزی", "Dizi"],
  "Shirazi Salad": ["سالاد شیرازی", "Salade shirazi"],
  "Mast-o-Khiar": ["ماست‌وخیار", "Mast-o-khiar"],
  Bastani: ["بستنی سنتی", "Bastani (glace persane)"],
  Faloodeh: ["فالوده", "Faloodeh"],
  "Sholeh Zard": ["شله‌زرد", "Sholeh zard"],
  Doogh: ["دوغ", "Doogh"],
  barberries: ["زرشک", "épine-vinette"],
  saffron: ["زعفران", "safran"],
  sumac: ["سماق", "sumac"],
  "dried lime": ["لیمو عمانی", "citron séché"],
  "kashk (fermented whey)": ["کشک", "kashk (petit-lait fermenté)"],
  "pomegranate molasses": ["رب انار", "mélasse de grenade"],
  rosewater: ["گلاب", "eau de rose"],
  pistachio: ["پسته", "pistache"],
  walnuts: ["گردو", "noix"],
  fenugreek: ["شنبلیله", "fenugrec"],
  "barbari bread": ["نان بربری", "pain barbari"],
  lavash: ["نان لواش", "pain lavash"],
  beef: ["گوشت گوساله", "bœuf"],
  lamb: ["گوشت گوسفند", "agneau"],
  skewer: ["سیخ", "brochette"],
  "spiced (seasoned)": ["ادویه‌دار", "épicé (assaisonné)"],
  "spicy (hot)": ["تند", "piquant"],
  "family tray": ["سینی خانوادگی", "plateau familial"],
  regular: ["معمولی", "régulier"],
  large: ["بزرگ", "grand"],
  small: ["کوچک", "petit"],
};

export const glossaryText = () =>
  Object.entries(GLOSSARY)
    .map(([en, [fa, fr]]) => `${en} → fa: ${fa} | fr: ${fr}`)
    .join("\n");
