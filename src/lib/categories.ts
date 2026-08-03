export interface Category {
  /** Value stored in the `category` column of the products table */
  key: 'generators' | 'chillers' | 'parts';
  /** Latin-transliterated URL slug used under /catalog/[slug] */
  slug: string;
  /** Georgian display name */
  name: string;
  /** Short Georgian description for tiles / SEO */
  desc: string;
  image: string;
}

export const CATEGORIES: Category[] = [
  {
    key: 'generators',
    slug: 'generatorebi',
    name: 'დიზელ-გენერატორები',
    desc: 'სარეზერვო და მუდმივი დენის წყარო 20-დან 500 kVA-მდე სიმძლავრით.',
    image: '/images/products/generator.svg',
  },
  {
    key: 'chillers',
    slug: 'chilerebi',
    name: 'ჩილერები',
    desc: 'სამრეწველო ჰაეროვანი გაგრილების ჩილერები მაღალი ეფექტურობით.',
    image: '/images/products/chiller.svg',
  },
  {
    key: 'parts',
    slug: 'natsilebi',
    name: 'სათადარიგო ნაწილები',
    desc: 'ორიგინალი ფილტრები, კონტროლერები და სახარჯი მასალები.',
    image: '/images/products/parts.svg',
  },
];

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function categoryName(key: string): string {
  return categoryByKey(key)?.name ?? key;
}
