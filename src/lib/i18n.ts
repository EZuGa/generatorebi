/**
 * Locale plumbing for the bilingual static site.
 * ka = default locale at root paths; ru = lives under the /ru prefix.
 * Slugs are identical across locales, so path mapping is mechanical.
 */

export type Lang = 'ka' | 'ru';
export const DEFAULT_LANG: Lang = 'ka';
export const LOCALES: Lang[] = ['ka', 'ru'];

/** "/catalog" → "/ru/catalog" for ru; ka paths pass through unchanged. */
export function localePath(path: string, lang: Lang): string {
  if (lang === 'ka') return path;
  return path === '/' ? '/ru' : `/ru${path}`;
}

/** "/ru/catalog/x" → "/catalog/x"; non-ru paths pass through. Trailing slash stripped (except root). */
export function stripRuPrefix(pathname: string): string {
  let path = pathname;
  if (path === '/ru' || path === '/ru/') return '/';
  if (path.startsWith('/ru/')) path = path.slice(3);
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/** Maps the current pathname to its equivalent in the target locale. */
export function switchLocalePath(pathname: string, target: Lang): string {
  return localePath(stripRuPrefix(pathname), target);
}

/* ---------- shared UI strings ---------- */

const STRINGS = {
  ka: {
    'nav.home': 'მთავარი',
    'nav.catalog': 'კატალოგი',
    'nav.blog': 'სტატიები',
    'nav.contact': 'კონტაქტი',
    'aria.logo': 'GENERATORI.COM.GE — მთავარი გვერდი',
    'aria.menu': 'მენიუს გახსნა',
    'aria.mainNav': 'მთავარი ნავიგაცია',
    'aria.footerNav': 'ქვედა ნავიგაცია',
    'aria.breadcrumbs': 'ბრედკრამბი',
    'aria.langSwitch': 'ენის შეცვლა',
    'breadcrumb.home': 'მთავარი',
    'product.priceOnRequest': 'ფასი მოთხოვნით',
    'product.details': 'დეტალურად →',
    'blog.read': 'წაიკითხეთ →',
    'search.placeholder': 'მოძებნეთ პროდუქტი კატალოგში…',
    'search.aria': 'პროდუქტის ძიება კატალოგში',
    'search.noResults': 'შედეგი ვერ მოიძებნა — სცადეთ სხვა საძიებო სიტყვა.',
    'footer.about':
      'დიზელ-გენერატორების, სამრეწველო ჩილერებისა და სათადარიგო ნაწილების მიწოდება საქართველოს მასშტაბით. გარანტია, მონტაჟი და სერვისი.',
    'footer.nav': 'ნავიგაცია',
    'footer.contact': 'კონტაქტი',
    'footer.rights': 'ყველა უფლება დაცულია',
    'footer.tagline': 'დიზელ-გენერატორები · ჩილერები · სათადარიგო ნაწილები',
    'contact.address': 'თბილისი, რუსთავის გზატკეცილი №2',
    'contact.hours': 'ორშ–შაბ: 09:00–18:00',
  },
  ru: {
    'nav.home': 'Главная',
    'nav.catalog': 'Каталог',
    'nav.blog': 'Статьи',
    'nav.contact': 'Контакты',
    'aria.logo': 'GENERATORI.COM.GE — главная страница',
    'aria.menu': 'Открыть меню',
    'aria.mainNav': 'Основная навигация',
    'aria.footerNav': 'Нижняя навигация',
    'aria.breadcrumbs': 'Хлебные крошки',
    'aria.langSwitch': 'Сменить язык',
    'breadcrumb.home': 'Главная',
    'product.priceOnRequest': 'Цена по запросу',
    'product.details': 'Подробнее →',
    'blog.read': 'Читать →',
    'search.placeholder': 'Найти продукт в каталоге…',
    'search.aria': 'Поиск продукта в каталоге',
    'search.noResults': 'Ничего не найдено — попробуйте другой запрос.',
    'footer.about':
      'Поставка дизель-генераторов, промышленных чиллеров и запасных частей по всей Грузии. Гарантия, монтаж и сервис.',
    'footer.nav': 'Навигация',
    'footer.contact': 'Контакты',
    'footer.rights': 'Все права защищены',
    'footer.tagline': 'Дизель-генераторы · Чиллеры · Запчасти',
    'contact.address': 'Тбилиси, Руставское шоссе №2',
    'contact.hours': 'Пн–Сб: 09:00–18:00',
  },
} as const;

export type StringKey = keyof (typeof STRINGS)['ka'];

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key];
}
