import type { Lang } from './i18n';

export interface Category {
  /** Value stored in the `category` column of the products table */
  key: 'generators' | 'chillers' | 'parts';
  /** Latin-transliterated URL slug used under /catalog/[slug] (shared by both locales) */
  slug: string;
  /** Georgian display name */
  name: string;
  /** Russian display name */
  name_ru: string;
  /** Short Georgian description for tiles / SEO */
  desc: string;
  /** Short Russian description for tiles / SEO */
  desc_ru: string;
  image: string;
}

export const CATEGORIES: Category[] = [
  {
    key: 'generators',
    slug: 'generatorebi',
    name: 'დიზელ-გენერატორები',
    name_ru: 'Дизель-генераторы',
    desc: 'სარეზერვო და მუდმივი დენის წყარო 20-დან 500 kVA-მდე სიმძლავრით.',
    desc_ru: 'Резервные и основные источники питания мощностью от 20 до 500 кВА.',
    image: '/images/products/generator.svg',
  },
  {
    key: 'chillers',
    slug: 'chilerebi',
    name: 'ჩილერები',
    name_ru: 'Чиллеры',
    desc: 'სამრეწველო ჰაეროვანი გაგრილების ჩილერები მაღალი ეფექტურობით.',
    desc_ru: 'Промышленные чиллеры воздушного охлаждения с высокой эффективностью.',
    image: '/images/products/chiller.svg',
  },
  {
    key: 'parts',
    slug: 'natsilebi',
    name: 'სათადარიგო ნაწილები',
    name_ru: 'Запасные части',
    desc: 'ორიგინალი ფილტრები, კონტროლერები და სახარჯი მასალები.',
    desc_ru: 'Оригинальные фильтры, контроллеры и расходные материалы.',
    image: '/images/products/parts.svg',
  },
];

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function categoryName(key: string, lang: Lang = 'ka'): string {
  const cat = categoryByKey(key);
  if (!cat) return key;
  return lang === 'ru' ? cat.name_ru : cat.name;
}

export function categoryDesc(key: string, lang: Lang = 'ka'): string {
  const cat = categoryByKey(key);
  if (!cat) return key;
  return lang === 'ru' ? cat.desc_ru : cat.desc;
}
