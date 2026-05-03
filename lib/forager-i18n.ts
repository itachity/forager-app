import type { LanguageCode } from "./forager-types";

export type I18nKey =
  | "landing.tagline"
  | "landing.subtagline"
  | "landing.continueGoogle"
  | "landing.continueGuest"
  | "landing.terms"
  | "landing.foodWords"
  | "home.tagline"
  | "home.snapMeal.title"
  | "home.snapMeal.desc"
  | "home.translateMenu.title"
  | "home.translateMenu.desc"
  | "nav.discover"
  | "nav.search"
  | "nav.scan"
  | "search.placeholder"
  | "search.cheatDay"
  | "search.cheatDay.on"
  | "search.cheatDay.off"
  | "search.cta"
  | "search.busy"
  | "search.noResults"
  | "search.failed"
  | "header.back"
  | "header.languageLabel"
  | "common.loading"
  | "common.demoMode";

type Dict = Record<I18nKey, string>;

const en: Dict = {
  "landing.tagline": "Discover your next food adventure.",
  "landing.subtagline":
    "Hidden food gems tailored to your taste, goals, and mood — from cozy late-night bites to your next high-protein bowl.",
  "landing.continueGoogle": "Continue with Google",
  "landing.continueGuest": "Continue as guest",
  "landing.terms": "By continuing you agree to our Terms & Privacy.",
  "landing.foodWords": "ramen,tacos,pho,biryani,ceviche,adobo,pasta,sushi,curry",
  "home.tagline": "Discover your next food adventure",
  "home.snapMeal.title": "Snap your meal",
  "home.snapMeal.desc": "Identify a dish, estimate macros, log it.",
  "home.translateMenu.title": "Translate a menu",
  "home.translateMenu.desc": "Decode any menu and rank dishes for you.",
  "nav.discover": "Discover",
  "nav.search": "Search",
  "nav.scan": "Scan",
  "search.placeholder": "Search for food... (e.g., high protein low calorie)",
  "search.cheatDay": "Cheat day",
  "search.cheatDay.on": "Bypassing your profile — anything goes.",
  "search.cheatDay.off": "Ignore my profile for this search.",
  "search.cta": "Find My Perfect Meal",
  "search.busy": "Foraging…",
  "search.noResults": "No results — try widening your search.",
  "search.failed": "Search failed. Showing demo results.",
  "header.back": "Back",
  "header.languageLabel": "Language",
  "common.loading": "Loading…",
  "common.demoMode": "Demo mode",
};

const es: Dict = {
  "landing.tagline": "Descubre tu próxima aventura culinaria.",
  "landing.subtagline":
    "Joyas gastronómicas escondidas adaptadas a tu gusto, objetivos y estado de ánimo — desde bocados acogedores hasta tu próximo bowl alto en proteínas.",
  "landing.continueGoogle": "Continuar con Google",
  "landing.continueGuest": "Continuar como invitado",
  "landing.terms": "Al continuar aceptas nuestros Términos y Privacidad.",
  "landing.foodWords": "tacos,paella,ceviche,ramen,pho,biryani,pasta,sushi,curry",
  "home.tagline": "Descubre tu próxima aventura culinaria",
  "home.snapMeal.title": "Foto a tu comida",
  "home.snapMeal.desc": "Identifica un plato, estima macros, regístralo.",
  "home.translateMenu.title": "Traducir un menú",
  "home.translateMenu.desc": "Decodifica cualquier menú y ordena los platos para ti.",
  "nav.discover": "Descubrir",
  "nav.search": "Buscar",
  "nav.scan": "Escanear",
  "search.placeholder": "Busca comida... (ej: alta en proteínas, bajo en calorías)",
  "search.cheatDay": "Día libre",
  "search.cheatDay.on": "Ignorando tu perfil — todo vale.",
  "search.cheatDay.off": "Ignorar mi perfil para esta búsqueda.",
  "search.cta": "Encontrar mi comida perfecta",
  "search.busy": "Buscando…",
  "search.noResults": "Sin resultados — intenta ampliar tu búsqueda.",
  "search.failed": "Búsqueda fallida. Mostrando datos de demostración.",
  "header.back": "Atrás",
  "header.languageLabel": "Idioma",
  "common.loading": "Cargando…",
  "common.demoMode": "Modo demostración",
};

const ja: Dict = {
  "landing.tagline": "次の食の冒険を見つけよう。",
  "landing.subtagline":
    "あなたの好み、目標、気分に合わせた隠れた美食 — 夜食から高タンパクボウルまで。",
  "landing.continueGoogle": "Googleで続ける",
  "landing.continueGuest": "ゲストとして続ける",
  "landing.terms": "続行することで利用規約とプライバシーに同意したことになります。",
  "landing.foodWords": "ラーメン,寿司,カレー,蕎麦,うどん,丼,焼き鳥,天ぷら,餃子",
  "home.tagline": "次の食の冒険を見つけよう",
  "home.snapMeal.title": "料理を撮影",
  "home.snapMeal.desc": "料理を識別し、栄養を推定し、記録します。",
  "home.translateMenu.title": "メニューを翻訳",
  "home.translateMenu.desc": "あらゆるメニューを解読し、料理をランキング。",
  "nav.discover": "発見",
  "nav.search": "検索",
  "nav.scan": "スキャン",
  "search.placeholder": "食べ物を検索...(例:高タンパク・低カロリー)",
  "search.cheatDay": "チートデイ",
  "search.cheatDay.on": "プロフィールを無視 — 何でもあり。",
  "search.cheatDay.off": "この検索ではプロフィールを無視。",
  "search.cta": "私の完璧な食事を探す",
  "search.busy": "探しています…",
  "search.noResults": "結果なし — 検索を広げてみてください。",
  "search.failed": "検索失敗。デモデータを表示します。",
  "header.back": "戻る",
  "header.languageLabel": "言語",
  "common.loading": "読み込み中…",
  "common.demoMode": "デモモード",
};

const zh: Dict = {
  "landing.tagline": "发现你的下一次美食冒险。",
  "landing.subtagline":
    "根据你的口味、目标和心情量身定制的隐藏美食 —— 从深夜小食到你的下一份高蛋白餐。",
  "landing.continueGoogle": "使用 Google 继续",
  "landing.continueGuest": "以访客身份继续",
  "landing.terms": "继续即表示您同意我们的条款和隐私政策。",
  "landing.foodWords": "拉面,寿司,饺子,火锅,炒饭,烧烤,粤菜,川菜,小笼包",
  "home.tagline": "发现你的下一次美食冒险",
  "home.snapMeal.title": "拍下你的餐",
  "home.snapMeal.desc": "识别菜品,估算营养,记录餐食。",
  "home.translateMenu.title": "翻译菜单",
  "home.translateMenu.desc": "解码任何菜单并为你排序推荐。",
  "nav.discover": "发现",
  "nav.search": "搜索",
  "nav.scan": "扫描",
  "search.placeholder": "搜索食物...(例如:高蛋白低热量)",
  "search.cheatDay": "放纵日",
  "search.cheatDay.on": "忽略你的偏好 — 想吃啥都行。",
  "search.cheatDay.off": "本次搜索忽略我的偏好。",
  "search.cta": "找到我的完美餐",
  "search.busy": "搜寻中…",
  "search.noResults": "没有结果 — 试试扩大搜索范围。",
  "search.failed": "搜索失败。显示演示数据。",
  "header.back": "返回",
  "header.languageLabel": "语言",
  "common.loading": "加载中…",
  "common.demoMode": "演示模式",
};

const tl: Dict = {
  "landing.tagline": "Tuklasin ang susunod mong pagkain na pakikipagsapalaran.",
  "landing.subtagline":
    "Mga nakatagong pagkaing piling-pili para sa iyong panlasa, layunin, at mood — mula sa late-night bites hanggang sa high-protein bowl.",
  "landing.continueGoogle": "Magpatuloy gamit ang Google",
  "landing.continueGuest": "Magpatuloy bilang bisita",
  "landing.terms": "Sa pagpapatuloy, sumasang-ayon ka sa aming Mga Tuntunin at Privacy.",
  "landing.foodWords": "adobo,sinigang,kare-kare,sisig,lechon,pancit,lumpia,ramen,sushi",
  "home.tagline": "Tuklasin ang susunod mong pagkain na pakikipagsapalaran",
  "home.snapMeal.title": "Kunan ng litrato ang pagkain",
  "home.snapMeal.desc": "Tukuyin ang ulam, tantyahin ang macros, i-log.",
  "home.translateMenu.title": "Isalin ang menu",
  "home.translateMenu.desc": "I-decode ang anumang menu at i-rank ang mga ulam para sa iyo.",
  "nav.discover": "Tuklasin",
  "nav.search": "Hanapin",
  "nav.scan": "I-scan",
  "search.placeholder": "Maghanap ng pagkain... (hal., high protein, low calorie)",
  "search.cheatDay": "Cheat day",
  "search.cheatDay.on": "Hindi ginagamit ang profile mo — kahit ano puwede.",
  "search.cheatDay.off": "Huwag isama ang profile ko sa paghahanap na ito.",
  "search.cta": "Hanapin ang Perpektong Pagkain Ko",
  "search.busy": "Naghahanap…",
  "search.noResults": "Walang resulta — palawakin ang paghahanap.",
  "search.failed": "Nabigo ang paghahanap. Ipinapakita ang demo data.",
  "header.back": "Bumalik",
  "header.languageLabel": "Wika",
  "common.loading": "Naglo-load…",
  "common.demoMode": "Demo mode",
};

const ru: Dict = {
  "landing.tagline": "Открой своё следующее кулинарное приключение.",
  "landing.subtagline":
    "Скрытые гастрономические жемчужины, подобранные под твой вкус, цели и настроение — от уютных ночных перекусов до белковой миски.",
  "landing.continueGoogle": "Продолжить с Google",
  "landing.continueGuest": "Продолжить как гость",
  "landing.terms": "Продолжая, вы соглашаетесь с Условиями и Политикой конфиденциальности.",
  "landing.foodWords": "борщ,пельмени,блины,рамэн,суши,карри,паста,севиче,тако",
  "home.tagline": "Открой своё следующее кулинарное приключение",
  "home.snapMeal.title": "Сфотографируй блюдо",
  "home.snapMeal.desc": "Определи блюдо, оцени макросы, сохрани.",
  "home.translateMenu.title": "Перевести меню",
  "home.translateMenu.desc": "Расшифруй любое меню и ранжируй блюда.",
  "nav.discover": "Открыть",
  "nav.search": "Поиск",
  "nav.scan": "Сканировать",
  "search.placeholder": "Найди еду... (напр., много белка, мало калорий)",
  "search.cheatDay": "Чит-день",
  "search.cheatDay.on": "Профиль игнорируется — всё дозволено.",
  "search.cheatDay.off": "Игнорировать мой профиль для этого поиска.",
  "search.cta": "Найти моё идеальное блюдо",
  "search.busy": "Ищу…",
  "search.noResults": "Нет результатов — расширьте поиск.",
  "search.failed": "Поиск не удался. Показаны демо-данные.",
  "header.back": "Назад",
  "header.languageLabel": "Язык",
  "common.loading": "Загрузка…",
  "common.demoMode": "Демо-режим",
};

export const I18N: Record<LanguageCode, Dict> = { en, es, ja, zh, tl, ru };

export function translate(lang: LanguageCode, key: I18nKey): string {
  return I18N[lang]?.[key] ?? I18N.en[key] ?? key;
}
