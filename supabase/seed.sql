-- Demo content: "Demo Bistro", Toronto. Used locally and on the demo environment only.
-- Some fa/fr translations are deliberately missing to exercise the English fallback.
-- Image keys are NULL until real images are uploaded via the CMS (the UI shows a placeholder).

insert into public.restaurants (id, name, slug, currency, timezone, locale, address, phone,
  hours_json, banner_message, is_published)
values ('00000000-0000-4000-8000-000000000001', 'Demo Bistro', 'demo-bistro', 'CAD',
  'America/Toronto', 'en-CA', '123 Queen St W, Toronto, ON', '+1 416 555 0100',
  '{"mon":[["17:00","22:00"]],"tue":[["17:00","22:00"]],"wed":[["17:00","22:00"]],"thu":[["17:00","22:00"]],"fri":[["17:00","23:00"]],"sat":[["12:00","23:00"]],"sun":[["12:00","21:00"]]}',
  null, true);

insert into public.categories (id, restaurant_id, name, slug, description, sort_order) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'Starters', 'starters', 'Small plates to share.', 1),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', 'Mains', 'mains', 'Grills and slow-cooked stews, served with saffron rice.', 2),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001', 'Desserts', 'desserts', null, 3);

insert into public.category_translations (category_id, locale, name, description) values
  ('00000000-0000-4000-8000-0000000000c1', 'fa', 'پیش‌غذا', 'بشقاب‌های کوچک برای اشتراک.'),
  ('00000000-0000-4000-8000-0000000000c1', 'fr', 'Entrées', 'Petites assiettes à partager.'),
  ('00000000-0000-4000-8000-0000000000c2', 'fa', 'غذای اصلی', 'کباب و خورش، با برنج زعفرانی.'),
  ('00000000-0000-4000-8000-0000000000c2', 'fr', 'Plats', 'Grillades et ragoûts mijotés, servis avec riz au safran.'),
  ('00000000-0000-4000-8000-0000000000c3', 'fa', 'دسر', null),
  ('00000000-0000-4000-8000-0000000000c3', 'fr', 'Desserts', null);

insert into public.tags (id, restaurant_id, label, kind, icon, sort_order) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'Vegan', 'dietary', 'leaf', 1),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'Vegetarian', 'dietary', 'carrot', 2),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'Halal', 'dietary', 'badge-check', 3),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', 'Gluten-free', 'dietary', 'wheat-off', 4),
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-000000000001', 'Chef''s pick', 'feature', 'chef-hat', 1),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'Tree nuts', 'allergen', 'nut', 1),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'Dairy', 'allergen', 'milk', 2),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000001', 'Gluten', 'allergen', 'wheat', 3),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-000000000001', 'Eggs', 'allergen', 'egg', 4),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-000000000001', 'Sesame', 'allergen', 'circle-dot', 5);

insert into public.tag_translations (tag_id, locale, label) values
  ('00000000-0000-4000-8000-0000000000a1', 'fa', 'وگان'), ('00000000-0000-4000-8000-0000000000a1', 'fr', 'Végane'),
  ('00000000-0000-4000-8000-0000000000a2', 'fa', 'گیاهی'), ('00000000-0000-4000-8000-0000000000a2', 'fr', 'Végétarien'),
  ('00000000-0000-4000-8000-0000000000a3', 'fa', 'حلال'), ('00000000-0000-4000-8000-0000000000a3', 'fr', 'Halal'),
  ('00000000-0000-4000-8000-0000000000a4', 'fa', 'بدون گلوتن'), ('00000000-0000-4000-8000-0000000000a4', 'fr', 'Sans gluten'),
  ('00000000-0000-4000-8000-0000000000a5', 'fa', 'پیشنهاد سرآشپز'), ('00000000-0000-4000-8000-0000000000a5', 'fr', 'Choix du chef'),
  ('00000000-0000-4000-8000-0000000000b1', 'fa', 'مغزها'), ('00000000-0000-4000-8000-0000000000b1', 'fr', 'Fruits à coque'),
  ('00000000-0000-4000-8000-0000000000b2', 'fa', 'لبنیات'), ('00000000-0000-4000-8000-0000000000b2', 'fr', 'Produits laitiers'),
  ('00000000-0000-4000-8000-0000000000b3', 'fa', 'گلوتن'), ('00000000-0000-4000-8000-0000000000b3', 'fr', 'Gluten'),
  ('00000000-0000-4000-8000-0000000000b4', 'fa', 'تخم‌مرغ'), ('00000000-0000-4000-8000-0000000000b4', 'fr', 'Œufs'),
  ('00000000-0000-4000-8000-0000000000b5', 'fa', 'کنجد'), ('00000000-0000-4000-8000-0000000000b5', 'fr', 'Sésame');

-- items: id suffix d<category><n>
insert into public.items (id, restaurant_id, category_id, name, slug, short_description, long_description,
  price_cents, availability, availability_note, remaining_qty, prep_minutes, calories, spice_level,
  is_featured, sort_order) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Kashk-e Bademjan', 'kashk-e-bademjan', 'Smoky eggplant dip with whey, fried mint and walnuts.',
   'Roasted eggplant mashed with caramelised onion and garlic, finished with kashk (fermented whey), crispy mint oil and toasted walnuts. Served with warm barbari bread.',
   1200, 'available', null, null, 10, 420, 0, true, 1),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Mirza Ghasemi', 'mirza-ghasemi', 'Charred eggplant, tomato, garlic and egg.',
   'A northern Iranian classic from Gilan: fire-charred eggplant cooked down with tomato, plenty of garlic and softly scrambled egg.',
   1100, 'limited', 'Last few portions tonight', 4, 10, 310, 1, false, 2),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Shirazi Salad', 'shirazi-salad', 'Cucumber, tomato and onion with lime and dried mint.',
   'Finely diced cucumber, tomato and red onion dressed with fresh lime juice, olive oil and dried mint. Bright, crunchy and vegan.',
   800, 'available', null, null, 5, 120, 0, false, 3),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1',
   'Soup of the Day', 'soup-of-the-day', 'Ask your server for today''s soup.',
   'A daily soup made in house — ask your server what the kitchen has prepared today.',
   900, 'unavailable', 'Sold out — back tomorrow', null, 5, null, 0, false, 0),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Koobideh Kebab', 'koobideh-kebab', 'Two skewers of grilled spiced ground beef and lamb.',
   'Hand-pressed skewers of ground beef and lamb seasoned with onion and sumac, grilled over charcoal. Served with saffron rice, grilled tomato and raw onion.',
   2400, 'available', null, null, 20, 980, 0, true, 1),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Joojeh Kebab', 'joojeh-kebab', 'Saffron and lemon marinated chicken skewers.',
   'Boneless chicken marinated overnight in saffron, lemon and yogurt, grilled over charcoal and served with saffron rice.',
   2300, 'available', null, null, 20, 820, 0, false, 2),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Ghormeh Sabzi', 'ghormeh-sabzi', 'Herb stew with kidney beans, dried lime and beef.',
   'Iran''s beloved herb stew: parsley, cilantro, fenugreek and chives slow-cooked with tender beef, kidney beans and dried Persian lime.',
   2200, 'available', null, null, 15, 760, 0, false, 3),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Fesenjan', 'fesenjan', 'Chicken in a pomegranate and walnut sauce.',
   'Chicken slowly braised in a rich sauce of ground walnuts and pomegranate molasses — sweet, tart and deeply savoury.',
   2500, 'unavailable', 'Sold out today', null, 15, 890, 0, false, 4),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2',
   'Vegetable Tahdig Bowl', 'vegetable-tahdig-bowl', 'Crispy saffron rice crust, roasted vegetables, herbs.',
   'Our crispiest tahdig topped with seasonal roasted vegetables, chickpeas, fresh herbs and a garlic-tahini drizzle.',
   1900, 'limited', null, 6, 20, 640, 1, false, 5),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3',
   'Saffron Ice Cream', 'saffron-ice-cream', 'Bastani with rosewater and pistachio.',
   'Traditional Persian bastani: rich saffron and rosewater ice cream with frozen cream shards and crushed pistachio.',
   900, 'available', null, null, 3, 380, 0, true, 1),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3',
   'Faloodeh', 'faloodeh', 'Frozen rice noodles in rosewater syrup with lime.',
   'Shiraz''s famous frozen dessert: thin rice noodles in a semi-frozen rosewater syrup, served with fresh lime and sour cherry.',
   800, 'available', null, null, 3, 250, 0, false, 2),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3',
   'Saffron Crème Brûlée', 'saffron-creme-brulee', 'Classic French custard infused with Persian saffron.',
   'A Paris–Tehran meeting: vanilla custard infused with saffron and cardamom under a crackling burnt-sugar top.',
   1000, 'available', null, null, 5, 450, 0, false, 3);

insert into public.item_tags (item_id, tag_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a5'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b3'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a4'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000b4'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000a4'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a3'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a4'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a5'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000a3'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000a4'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000a3'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000a4'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000a3'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000a4'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000b1'),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000b5'),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000b1'),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000b4');

insert into public.item_variants (item_id, name, price_delta_cents, sort_order) values
  ('00000000-0000-4000-8000-0000000000e1', 'Single skewer', -600, 1),
  ('00000000-0000-4000-8000-0000000000e1', 'Two skewers', 0, 2),
  ('00000000-0000-4000-8000-0000000000e1', 'Family tray (6 skewers)', 3600, 3);

-- Translations. Missing on purpose: fr for Mirza Ghasemi, fa+fr for Soup of the Day,
-- fa for Saffron Crème Brûlée — these must fall back to English.
insert into public.item_translations (item_id, locale, name, short_description, long_description, availability_note) values
  ('00000000-0000-4000-8000-0000000000d1', 'fa', 'کشک بادمجان', 'بادمجان دودی با کشک، نعنا داغ و گردو.', 'بادمجان کبابی با پیاز داغ و سیر، کشک، نعنا داغ و گردوی برشته. همراه با نان بربری گرم.', null),
  ('00000000-0000-4000-8000-0000000000d1', 'fr', 'Kashk-e Bademjan', 'Caviar d''aubergine fumé, petit-lait, menthe frite et noix.', 'Aubergine rôtie écrasée avec oignon caramélisé et ail, kashk (petit-lait fermenté), huile de menthe croustillante et noix grillées. Servi avec du pain barbari chaud.', null),
  ('00000000-0000-4000-8000-0000000000d2', 'fa', 'میرزا قاسمی', 'بادمجان کبابی، گوجه، سیر و تخم‌مرغ.', 'غذای کلاسیک گیلانی: بادمجان کبابی پخته با گوجه، سیر فراوان و تخم‌مرغ.', 'چند پرس آخر امشب'),
  ('00000000-0000-4000-8000-0000000000d3', 'fa', 'سالاد شیرازی', 'خیار، گوجه و پیاز با آبلیمو و نعنا خشک.', 'خیار، گوجه و پیاز قرمز ریز خردشده با آبلیموی تازه، روغن زیتون و نعنا خشک.', null),
  ('00000000-0000-4000-8000-0000000000d3', 'fr', 'Salade Shirazi', 'Concombre, tomate et oignon, citron vert et menthe séchée.', 'Concombre, tomate et oignon rouge en petits dés, assaisonnés de jus de citron vert, d''huile d''olive et de menthe séchée.', null),
  ('00000000-0000-4000-8000-0000000000e1', 'fa', 'کباب کوبیده', 'دو سیخ کباب گوشت چرخ‌کرده گوسفند و گوساله.', 'سیخ‌های کوبیده با پیاز و سماق، کباب‌شده روی زغال. همراه با برنج زعفرانی، گوجه کبابی و پیاز.', null),
  ('00000000-0000-4000-8000-0000000000e1', 'fr', 'Kebab Koobideh', 'Deux brochettes de bœuf et d''agneau hachés et épicés.', 'Brochettes de bœuf et d''agneau hachés, assaisonnées d''oignon et de sumac, grillées au charbon. Servies avec riz au safran, tomate grillée et oignon cru.', null),
  ('00000000-0000-4000-8000-0000000000e2', 'fa', 'جوجه کباب', 'جوجه کباب زعفرانی و لیمویی.', 'سینه مرغ بدون استخوان در زعفران، لیمو و ماست، کباب‌شده روی زغال، همراه با برنج زعفرانی.', null),
  ('00000000-0000-4000-8000-0000000000e2', 'fr', 'Kebab Joojeh', 'Brochettes de poulet marinées au safran et au citron.', 'Poulet désossé mariné toute la nuit au safran, citron et yaourt, grillé au charbon et servi avec riz au safran.', null),
  ('00000000-0000-4000-8000-0000000000e3', 'fa', 'قورمه سبزی', 'خورش سبزی با لوبیا قرمز، لیمو عمانی و گوشت.', 'محبوب‌ترین خورش ایرانی: جعفری، گشنیز، شنبلیله و تره، پخته با گوشت، لوبیا قرمز و لیمو عمانی.', null),
  ('00000000-0000-4000-8000-0000000000e3', 'fr', 'Ghormeh Sabzi', 'Ragoût aux herbes, haricots rouges, citron séché et bœuf.', 'Le ragoût aux herbes préféré d''Iran : persil, coriandre, fenugrec et ciboulette mijotés avec du bœuf, des haricots rouges et du citron séché.', null),
  ('00000000-0000-4000-8000-0000000000e4', 'fa', 'فسنجان', 'مرغ در سس انار و گردو.', 'مرغ پخته‌شده آرام در سس گردوی آسیاب‌شده و رب انار — ملس و خوش‌طعم.', 'امروز تمام شد'),
  ('00000000-0000-4000-8000-0000000000e4', 'fr', 'Fesenjan', 'Poulet à la sauce grenade et noix.', 'Poulet braisé lentement dans une sauce de noix moulues et de mélasse de grenade — sucré, acidulé et profond.', 'Épuisé aujourd''hui'),
  ('00000000-0000-4000-8000-0000000000e5', 'fa', 'کاسه ته‌دیگ سبزیجات', 'ته‌دیگ زعفرانی ترد، سبزیجات کبابی، سبزی.', 'ترد‌ترین ته‌دیگ ما با سبزیجات فصل، نخود، سبزی تازه و سس سیر و ارده.', null),
  ('00000000-0000-4000-8000-0000000000e5', 'fr', 'Bol de tahdig aux légumes', 'Croûte de riz au safran croustillante, légumes rôtis, herbes.', 'Notre tahdig le plus croustillant, garni de légumes de saison rôtis, pois chiches, herbes fraîches et filet de sauce tahini à l''ail.', null),
  ('00000000-0000-4000-8000-0000000000f1', 'fa', 'بستنی زعفرانی', 'بستنی سنتی با گلاب و پسته.', 'بستنی سنتی ایرانی: زعفران و گلاب با تکه‌های خامه یخ‌زده و پسته خردشده.', null),
  ('00000000-0000-4000-8000-0000000000f1', 'fr', 'Glace au safran', 'Bastani à l''eau de rose et pistache.', 'Bastani persan traditionnel : glace riche au safran et à l''eau de rose, éclats de crème glacée et pistaches concassées.', null),
  ('00000000-0000-4000-8000-0000000000f2', 'fa', 'فالوده', 'رشته یخ‌زده در شربت گلاب با آبلیمو.', 'دسر معروف شیراز: رشته‌های نازک برنج در شربت نیمه‌یخ‌زده گلاب، با آبلیمو و آلبالو.', null),
  ('00000000-0000-4000-8000-0000000000f2', 'fr', 'Faloodeh', 'Vermicelles de riz glacés au sirop d''eau de rose et citron vert.', 'Le célèbre dessert glacé de Chiraz : fines nouilles de riz dans un sirop d''eau de rose mi-glacé, servi avec citron vert et griotte.', null),
  ('00000000-0000-4000-8000-0000000000f3', 'fr', 'Crème brûlée au safran', 'Crème classique française infusée au safran persan.', 'Une rencontre Paris–Téhéran : crème à la vanille infusée au safran et à la cardamome sous une croûte de sucre caramélisé.', null);

insert into public.qr_codes (restaurant_id, label, target_path, slug)
values ('00000000-0000-4000-8000-000000000001', 'Main menu', '/', 'main');

-- Seeding is not a user action.
truncate public.audit_log;
