import type { LanguageCode } from "./forager-types";

export type I18nKey =
  // Landing
  | "landing.tagline"
  | "landing.subtagline"
  | "landing.continueGoogle"
  | "landing.continueGuest"
  | "landing.terms"
  | "landing.foodWords"
  // Home
  | "home.tagline"
  | "home.snapMeal.title"
  | "home.snapMeal.desc"
  | "home.translateMenu.title"
  | "home.translateMenu.desc"
  // Bottom nav
  | "nav.discover"
  | "nav.search"
  | "nav.scan"
  // Search panel
  | "search.placeholder"
  | "search.cheatDay"
  | "search.cheatDay.on"
  | "search.cheatDay.off"
  | "search.cta"
  | "search.busy"
  | "search.noResults"
  | "search.failed"
  // Header
  | "header.back"
  | "header.languageLabel"
  // Common
  | "common.loading"
  | "common.demoMode"
  // Scan toggle
  | "scan.toggle.snapMeal"
  | "scan.toggle.translateMenu"
  // Scan capture (food)
  | "scan.food.eyebrow"
  | "scan.food.heading"
  | "scan.food.subtitle"
  | "scan.food.helperPrimary"
  | "scan.food.helperSecondary"
  | "scan.food.loading"
  | "scan.food.loadingDetail"
  | "scan.food.errorAnalyze"
  | "scan.food.errorFailed"
  // Scan capture (menu)
  | "scan.menu.eyebrow"
  | "scan.menu.heading"
  | "scan.menu.subtitle"
  | "scan.menu.helperPrimary"
  | "scan.menu.helperSecondary"
  | "scan.menu.loading"
  | "scan.menu.loadingDetail"
  | "scan.menu.errorAnalyze"
  | "scan.menu.errorFailed"
  // Scan capture buttons / tip
  | "capture.camera"
  | "capture.upload"
  | "capture.processing"
  | "capture.tip"
  | "capture.analyzing"
  | "capture.uploadPreview"
  // Food result
  | "foodResult.matchSuffix"
  | "foodResult.likelyIngredients"
  | "foodResult.followup.heading"
  | "foodResult.followup.note"
  | "foodResult.refining"
  | "foodResult.refine"
  | "foodResult.estimatedMacros"
  | "foodResult.howToLog"
  | "foodResult.tweakNext"
  | "foodResult.tryAnother"
  | "foodResult.logMeal"
  | "foodResult.toast.tryAnother"
  | "foodResult.toast.couldnt"
  | "foodResult.toast.refined"
  | "foodResult.toast.logged"
  | "foodResult.toast.historyOff"
  | "foodResult.safety"
  // Menu result
  | "menuResult.menuSuffix"
  | "menuResult.translatingTo"
  | "menuResult.localEtiquette"
  | "menuResult.topPicks"
  | "menuResult.whyItFits"
  | "menuResult.estUnavailable"
  | "menuResult.sayToServer"
  | "menuResult.showAll"
  | "menuResult.hide"
  | "menuResult.phrasesToSay"
  | "menuResult.copy"
  | "menuResult.copied"
  | "menuResult.copyError"
  | "menuResult.tryAnother"
  | "menuResult.safety"
  // Recommendation card
  | "rec.topPick"
  | "rec.viewMenu"
  | "rec.orderThis"
  | "rec.estPrefix"
  | "rec.why"
  | "rec.tradeoffs"
  | "rec.openInMaps"
  // Macros (shared)
  | "macros.calories"
  | "macros.protein"
  | "macros.carbs"
  | "macros.fat"
  | "macros.medium"
  // Time card
  | "time.open24h"
  | "time.closedToday"
  | "time.closesIn"
  | "time.openCloses"
  | "time.closedOpens"
  | "time.unavailable"
  // Demo banner
  | "demoBanner.default"
  // Results page
  | "results.safety";

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

  "scan.toggle.snapMeal": "Snap meal",
  "scan.toggle.translateMenu": "Translate menu",

  "scan.food.eyebrow": "Scan",
  "scan.food.heading": "Snap your meal",
  "scan.food.subtitle":
    "We'll identify the dish, estimate macros, and suggest how to log it.",
  "scan.food.helperPrimary": "Take or upload a photo",
  "scan.food.helperSecondary":
    "Best results with good lighting and the whole plate visible.",
  "scan.food.loading": "Identifying your meal…",
  "scan.food.loadingDetail": "Naming ingredients and estimating macros.",
  "scan.food.errorAnalyze": "Couldn't analyze this image.",
  "scan.food.errorFailed": "Failed to analyze. Showing demo data.",

  "scan.menu.eyebrow": "Scan",
  "scan.menu.heading": "Translate a menu",
  "scan.menu.subtitle":
    "We'll translate the menu, flag your allergens, and rank dishes for you — plus phrases for the server.",
  "scan.menu.helperPrimary": "Take or upload a photo",
  "scan.menu.helperSecondary":
    "Get the whole menu in frame, even if it's blurry — Forager will do its best.",
  "scan.menu.loading": "Translating & ranking dishes…",
  "scan.menu.loadingDetail": "Reading the menu and learning the cuisine's etiquette.",
  "scan.menu.errorAnalyze": "Couldn't translate this menu.",
  "scan.menu.errorFailed": "Failed to translate. Showing demo data.",

  "capture.camera": "Camera",
  "capture.upload": "Upload",
  "capture.processing":
    "Processing image… you can upload another after this finishes.",
  "capture.tip":
    "Tip: upload a full-page menu photo with clear prices for best results.",
  "capture.analyzing": "Analyzing…",
  "capture.uploadPreview": "Upload preview",

  "foodResult.matchSuffix": "match",
  "foodResult.likelyIngredients": "Likely ingredients",
  "foodResult.followup.heading": "A couple more details",
  "foodResult.followup.note": "These sharpen the macro estimate.",
  "foodResult.refining": "Refining…",
  "foodResult.refine": "Refine estimate",
  "foodResult.estimatedMacros": "Estimated macros",
  "foodResult.howToLog": "How to log this",
  "foodResult.tweakNext": "Tweak next time",
  "foodResult.tryAnother": "Try another",
  "foodResult.logMeal": "Log this meal",
  "foodResult.toast.tryAnother": "Try another photo to refine.",
  "foodResult.toast.couldnt": "Couldn't refine. Showing original estimate.",
  "foodResult.toast.refined": "Refined.",
  "foodResult.toast.logged": "Logged.",
  "foodResult.toast.historyOff":
    "Meal history is off — turn it on in your profile to log.",
  "foodResult.safety":
    "Macros are an estimate. Verify with the restaurant if you have a strict goal.",

  "menuResult.menuSuffix": "menu",
  "menuResult.translatingTo": "Translating into",
  "menuResult.localEtiquette": "Local etiquette",
  "menuResult.topPicks": "Top picks for you",
  "menuResult.whyItFits": "Why it fits",
  "menuResult.estUnavailable": "Est. unavailable",
  "menuResult.sayToServer": "Say to the server",
  "menuResult.showAll": "Show all",
  "menuResult.hide": "Hide",
  "menuResult.phrasesToSay": "Phrases to say",
  "menuResult.copy": "Copy",
  "menuResult.copied": "Copied",
  "menuResult.copyError": "Couldn't copy to clipboard.",
  "menuResult.tryAnother": "Try another menu",
  "menuResult.safety":
    "Forager can flag possible risks, but verify allergens and preparation with the restaurant.",

  "rec.topPick": "Top pick",
  "rec.viewMenu": "View menu",
  "rec.orderThis": "Order this",
  "rec.estPrefix": "est.",
  "rec.why": "Why",
  "rec.tradeoffs": "Tradeoffs",
  "rec.openInMaps": "Open in Maps",

  "macros.calories": "Calories",
  "macros.protein": "Protein",
  "macros.carbs": "Carbs",
  "macros.fat": "Fat",
  "macros.medium": "Macros",

  "time.open24h": "Open 24 hours today",
  "time.closedToday": "Closed today",
  "time.closesIn": "Closes in",
  "time.openCloses": "Open · closes",
  "time.closedOpens": "Closed · opens",
  "time.unavailable": "Hours unavailable",

  "demoBanner.default":
    "Demo data — backend offline. The flow still works end-to-end.",

  "results.safety":
    "Allergen calls are best-effort. Verify with the restaurant before ordering if you have a strict dietary need.",
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

  "scan.toggle.snapMeal": "Foto comida",
  "scan.toggle.translateMenu": "Traducir menú",

  "scan.food.eyebrow": "Escanear",
  "scan.food.heading": "Foto a tu comida",
  "scan.food.subtitle":
    "Identificaremos el plato, estimaremos macros y sugeriremos cómo registrarlo.",
  "scan.food.helperPrimary": "Toma o sube una foto",
  "scan.food.helperSecondary":
    "Mejores resultados con buena luz y todo el plato visible.",
  "scan.food.loading": "Identificando tu comida…",
  "scan.food.loadingDetail": "Nombrando ingredientes y estimando macros.",
  "scan.food.errorAnalyze": "No se pudo analizar esta imagen.",
  "scan.food.errorFailed": "Falló el análisis. Mostrando datos de demo.",

  "scan.menu.eyebrow": "Escanear",
  "scan.menu.heading": "Traducir un menú",
  "scan.menu.subtitle":
    "Traduciremos el menú, marcaremos tus alérgenos y clasificaremos los platos — más frases para el camarero.",
  "scan.menu.helperPrimary": "Toma o sube una foto",
  "scan.menu.helperSecondary":
    "Encuadra todo el menú, aunque esté borroso — Forager lo intentará.",
  "scan.menu.loading": "Traduciendo y clasificando platos…",
  "scan.menu.loadingDetail": "Leyendo el menú y aprendiendo la etiqueta.",
  "scan.menu.errorAnalyze": "No se pudo traducir este menú.",
  "scan.menu.errorFailed": "Falló la traducción. Mostrando datos de demo.",

  "capture.camera": "Cámara",
  "capture.upload": "Subir",
  "capture.processing":
    "Procesando imagen… puedes subir otra cuando termine.",
  "capture.tip":
    "Tip: sube una foto del menú entero con precios claros para mejores resultados.",
  "capture.analyzing": "Analizando…",
  "capture.uploadPreview": "Vista previa",

  "foodResult.matchSuffix": "coincidencia",
  "foodResult.likelyIngredients": "Ingredientes probables",
  "foodResult.followup.heading": "Un par de detalles más",
  "foodResult.followup.note": "Esto afina la estimación de macros.",
  "foodResult.refining": "Refinando…",
  "foodResult.refine": "Refinar estimación",
  "foodResult.estimatedMacros": "Macros estimadas",
  "foodResult.howToLog": "Cómo registrar esto",
  "foodResult.tweakNext": "Ajusta la próxima vez",
  "foodResult.tryAnother": "Probar otra",
  "foodResult.logMeal": "Registrar esta comida",
  "foodResult.toast.tryAnother": "Prueba otra foto para refinar.",
  "foodResult.toast.couldnt": "No se pudo refinar. Mostrando estimación original.",
  "foodResult.toast.refined": "Refinado.",
  "foodResult.toast.logged": "Registrado.",
  "foodResult.toast.historyOff":
    "El historial de comidas está apagado — actívalo en tu perfil para registrar.",
  "foodResult.safety":
    "Las macros son una estimación. Verifica con el restaurante si tienes un objetivo estricto.",

  "menuResult.menuSuffix": "menú",
  "menuResult.translatingTo": "Traduciendo a",
  "menuResult.localEtiquette": "Etiqueta local",
  "menuResult.topPicks": "Mejores opciones para ti",
  "menuResult.whyItFits": "Por qué encaja",
  "menuResult.estUnavailable": "Est. no disponible",
  "menuResult.sayToServer": "Decir al camarero",
  "menuResult.showAll": "Mostrar todos",
  "menuResult.hide": "Ocultar",
  "menuResult.phrasesToSay": "Frases para decir",
  "menuResult.copy": "Copiar",
  "menuResult.copied": "Copiado",
  "menuResult.copyError": "No se pudo copiar al portapapeles.",
  "menuResult.tryAnother": "Probar otro menú",
  "menuResult.safety":
    "Forager puede señalar riesgos posibles, pero verifica alérgenos y preparación con el restaurante.",

  "rec.topPick": "Mejor opción",
  "rec.viewMenu": "Ver menú",
  "rec.orderThis": "Pide esto",
  "rec.estPrefix": "est.",
  "rec.why": "Por qué",
  "rec.tradeoffs": "Compensaciones",
  "rec.openInMaps": "Abrir en Maps",

  "macros.calories": "Calorías",
  "macros.protein": "Proteína",
  "macros.carbs": "Carbohidratos",
  "macros.fat": "Grasa",
  "macros.medium": "Macros",

  "time.open24h": "Abierto 24 horas hoy",
  "time.closedToday": "Cerrado hoy",
  "time.closesIn": "Cierra en",
  "time.openCloses": "Abierto · cierra",
  "time.closedOpens": "Cerrado · abre",
  "time.unavailable": "Horario no disponible",

  "demoBanner.default":
    "Datos de demostración — backend desconectado. El flujo funciona de extremo a extremo.",

  "results.safety":
    "Las advertencias de alérgenos son aproximadas. Verifica con el restaurante antes de pedir si tienes una restricción estricta.",
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

  "scan.toggle.snapMeal": "料理撮影",
  "scan.toggle.translateMenu": "メニュー翻訳",

  "scan.food.eyebrow": "スキャン",
  "scan.food.heading": "料理を撮影",
  "scan.food.subtitle":
    "料理を識別し、栄養を推定し、記録方法を提案します。",
  "scan.food.helperPrimary": "撮影またはアップロード",
  "scan.food.helperSecondary":
    "明るい場所でお皿全体が映ると最良の結果になります。",
  "scan.food.loading": "料理を識別中…",
  "scan.food.loadingDetail": "材料の特定と栄養素の推定。",
  "scan.food.errorAnalyze": "この画像を分析できませんでした。",
  "scan.food.errorFailed": "分析に失敗しました。デモデータを表示します。",

  "scan.menu.eyebrow": "スキャン",
  "scan.menu.heading": "メニューを翻訳",
  "scan.menu.subtitle":
    "メニューを翻訳し、アレルゲンを警告し、料理をランキング — 店員さん向けのフレーズも。",
  "scan.menu.helperPrimary": "撮影またはアップロード",
  "scan.menu.helperSecondary":
    "ぼやけていてもメニュー全体を画面に収めてください — Foragerが頑張ります。",
  "scan.menu.loading": "翻訳とランキング中…",
  "scan.menu.loadingDetail": "メニューを読み、料理のマナーを学習中。",
  "scan.menu.errorAnalyze": "このメニューを翻訳できませんでした。",
  "scan.menu.errorFailed": "翻訳に失敗しました。デモデータを表示します。",

  "capture.camera": "カメラ",
  "capture.upload": "アップロード",
  "capture.processing":
    "画像を処理中…完了後に別の画像をアップロードできます。",
  "capture.tip":
    "ヒント:価格がはっきり見えるメニュー全体の写真がベスト。",
  "capture.analyzing": "分析中…",
  "capture.uploadPreview": "プレビュー",

  "foodResult.matchSuffix": "一致",
  "foodResult.likelyIngredients": "想定される材料",
  "foodResult.followup.heading": "もう少し詳しく",
  "foodResult.followup.note": "栄養推定の精度が上がります。",
  "foodResult.refining": "精度を上げています…",
  "foodResult.refine": "推定を改善",
  "foodResult.estimatedMacros": "推定栄養素",
  "foodResult.howToLog": "記録の仕方",
  "foodResult.tweakNext": "次回の改善案",
  "foodResult.tryAnother": "別の写真",
  "foodResult.logMeal": "この食事を記録",
  "foodResult.toast.tryAnother": "別の写真で精度を上げてみてください。",
  "foodResult.toast.couldnt": "改善できませんでした。元の推定を表示。",
  "foodResult.toast.refined": "改善しました。",
  "foodResult.toast.logged": "記録しました。",
  "foodResult.toast.historyOff":
    "食事履歴がオフ — プロフィールでオンにすると記録できます。",
  "foodResult.safety":
    "栄養素は推定値です。厳格な目標があれば店舗で確認してください。",

  "menuResult.menuSuffix": "メニュー",
  "menuResult.translatingTo": "翻訳先",
  "menuResult.localEtiquette": "現地のマナー",
  "menuResult.topPicks": "あなたへのおすすめ",
  "menuResult.whyItFits": "おすすめ理由",
  "menuResult.estUnavailable": "推定なし",
  "menuResult.sayToServer": "店員さんへ",
  "menuResult.showAll": "全て表示",
  "menuResult.hide": "隠す",
  "menuResult.phrasesToSay": "使えるフレーズ",
  "menuResult.copy": "コピー",
  "menuResult.copied": "コピー済",
  "menuResult.copyError": "クリップボードへコピーできませんでした。",
  "menuResult.tryAnother": "別のメニュー",
  "menuResult.safety":
    "Foragerはリスクを警告できますが、アレルゲンと調理法は店舗で確認してください。",

  "rec.topPick": "イチオシ",
  "rec.viewMenu": "メニューを見る",
  "rec.orderThis": "これを注文",
  "rec.estPrefix": "推定",
  "rec.why": "理由",
  "rec.tradeoffs": "トレードオフ",
  "rec.openInMaps": "マップで開く",

  "macros.calories": "カロリー",
  "macros.protein": "タンパク質",
  "macros.carbs": "炭水化物",
  "macros.fat": "脂質",
  "macros.medium": "栄養素",

  "time.open24h": "本日24時間営業",
  "time.closedToday": "本日定休",
  "time.closesIn": "閉店まで",
  "time.openCloses": "営業中 · 閉店",
  "time.closedOpens": "閉店中 · 開店",
  "time.unavailable": "営業時間不明",

  "demoBanner.default":
    "デモデータ — バックエンドオフライン。フローはエンドツーエンドで動作します。",

  "results.safety":
    "アレルゲン情報はベストエフォートです。厳格な制限がある場合は店舗で確認してください。",
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

  "scan.toggle.snapMeal": "拍餐",
  "scan.toggle.translateMenu": "翻译菜单",

  "scan.food.eyebrow": "扫描",
  "scan.food.heading": "拍下你的餐",
  "scan.food.subtitle":
    "我们将识别菜品、估算营养并建议如何记录。",
  "scan.food.helperPrimary": "拍照或上传",
  "scan.food.helperSecondary": "光线好、整盘可见时效果最佳。",
  "scan.food.loading": "正在识别你的餐…",
  "scan.food.loadingDetail": "识别食材并估算营养。",
  "scan.food.errorAnalyze": "无法分析此图像。",
  "scan.food.errorFailed": "分析失败。显示演示数据。",

  "scan.menu.eyebrow": "扫描",
  "scan.menu.heading": "翻译菜单",
  "scan.menu.subtitle":
    "我们将翻译菜单、标记过敏原、为你排序菜品 —— 还有点餐用语。",
  "scan.menu.helperPrimary": "拍照或上传",
  "scan.menu.helperSecondary":
    "把整张菜单拍进画面,即使有点模糊 —— Forager 会尽力。",
  "scan.menu.loading": "翻译并排序菜品中…",
  "scan.menu.loadingDetail": "阅读菜单并学习当地餐饮礼仪。",
  "scan.menu.errorAnalyze": "无法翻译此菜单。",
  "scan.menu.errorFailed": "翻译失败。显示演示数据。",

  "capture.camera": "相机",
  "capture.upload": "上传",
  "capture.processing":
    "正在处理图像…完成后可继续上传下一张。",
  "capture.tip":
    "提示:整页菜单且价格清晰的照片效果最佳。",
  "capture.analyzing": "分析中…",
  "capture.uploadPreview": "预览",

  "foodResult.matchSuffix": "匹配度",
  "foodResult.likelyIngredients": "可能的食材",
  "foodResult.followup.heading": "再确认几个细节",
  "foodResult.followup.note": "这能让营养估算更准。",
  "foodResult.refining": "优化中…",
  "foodResult.refine": "优化估算",
  "foodResult.estimatedMacros": "估算营养",
  "foodResult.howToLog": "如何记录",
  "foodResult.tweakNext": "下次小调整",
  "foodResult.tryAnother": "换一张",
  "foodResult.logMeal": "记录这一餐",
  "foodResult.toast.tryAnother": "换一张照片以优化结果。",
  "foodResult.toast.couldnt": "无法优化。显示原始估算。",
  "foodResult.toast.refined": "已优化。",
  "foodResult.toast.logged": "已记录。",
  "foodResult.toast.historyOff":
    "餐食历史已关闭 — 在个人资料中开启以记录。",
  "foodResult.safety":
    "营养仅为估算。如有严格目标请向餐厅确认。",

  "menuResult.menuSuffix": "菜单",
  "menuResult.translatingTo": "翻译为",
  "menuResult.localEtiquette": "当地礼仪",
  "menuResult.topPicks": "为你精选",
  "menuResult.whyItFits": "推荐理由",
  "menuResult.estUnavailable": "估算不可用",
  "menuResult.sayToServer": "对店员说",
  "menuResult.showAll": "显示全部",
  "menuResult.hide": "隐藏",
  "menuResult.phrasesToSay": "实用语句",
  "menuResult.copy": "复制",
  "menuResult.copied": "已复制",
  "menuResult.copyError": "无法复制到剪贴板。",
  "menuResult.tryAnother": "换一份菜单",
  "menuResult.safety":
    "Forager 可标记潜在风险,但请向餐厅核实过敏原与做法。",

  "rec.topPick": "首选",
  "rec.viewMenu": "查看菜单",
  "rec.orderThis": "点这个",
  "rec.estPrefix": "估算",
  "rec.why": "理由",
  "rec.tradeoffs": "取舍",
  "rec.openInMaps": "在地图打开",

  "macros.calories": "热量",
  "macros.protein": "蛋白质",
  "macros.carbs": "碳水",
  "macros.fat": "脂肪",
  "macros.medium": "营养",

  "time.open24h": "今日24小时营业",
  "time.closedToday": "今日休息",
  "time.closesIn": "还有",
  "time.openCloses": "营业中 · 闭店",
  "time.closedOpens": "已关 · 开门",
  "time.unavailable": "营业时间未知",

  "demoBanner.default":
    "演示数据 — 后端离线。流程仍可端到端运行。",

  "results.safety":
    "过敏原警示为尽力而为。如有严格膳食限制请下单前向餐厅确认。",
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

  "scan.toggle.snapMeal": "Litrato ulam",
  "scan.toggle.translateMenu": "Isalin menu",

  "scan.food.eyebrow": "I-scan",
  "scan.food.heading": "Kunan ng litrato ang pagkain",
  "scan.food.subtitle":
    "Tutukuyin namin ang ulam, tantyahin ang macros, at imumungkahi kung paano i-log.",
  "scan.food.helperPrimary": "Kumuha o mag-upload ng litrato",
  "scan.food.helperSecondary":
    "Pinakamaganda kapag malinaw ang ilaw at buo ang plato sa kuha.",
  "scan.food.loading": "Tinutukoy ang iyong pagkain…",
  "scan.food.loadingDetail": "Pinapangalanan ang sangkap at tinitiyak ang macros.",
  "scan.food.errorAnalyze": "Hindi masuri ang larawang ito.",
  "scan.food.errorFailed": "Nabigong i-analyze. Ipinapakita ang demo data.",

  "scan.menu.eyebrow": "I-scan",
  "scan.menu.heading": "Isalin ang menu",
  "scan.menu.subtitle":
    "Isasalin namin ang menu, tatandaan ang allergens, at ira-rank ang mga ulam — at mga parirala para sa server.",
  "scan.menu.helperPrimary": "Kumuha o mag-upload ng litrato",
  "scan.menu.helperSecondary":
    "Ipakita ang buong menu sa frame, kahit malabo — gagawa ng paraan ang Forager.",
  "scan.menu.loading": "Isinasalin at nira-rank ang mga ulam…",
  "scan.menu.loadingDetail": "Binabasa ang menu at inaaral ang etika ng lutuin.",
  "scan.menu.errorAnalyze": "Hindi maisalin ang menu na ito.",
  "scan.menu.errorFailed": "Nabigong isalin. Ipinapakita ang demo data.",

  "capture.camera": "Camera",
  "capture.upload": "Upload",
  "capture.processing":
    "Pinoproseso ang larawan… makapag-upload ka muli pagkatapos.",
  "capture.tip":
    "Tip: ang full-page menu na may malinaw na presyo ang pinakamabisa.",
  "capture.analyzing": "Sinusuri…",
  "capture.uploadPreview": "Preview",

  "foodResult.matchSuffix": "tugma",
  "foodResult.likelyIngredients": "Posibleng sangkap",
  "foodResult.followup.heading": "Ilang detalye pa",
  "foodResult.followup.note": "Mas magiging tumpak ang macro estimate.",
  "foodResult.refining": "Nire-refine…",
  "foodResult.refine": "I-refine ang estimate",
  "foodResult.estimatedMacros": "Tantyang macros",
  "foodResult.howToLog": "Paano i-log",
  "foodResult.tweakNext": "Susunod ayusin",
  "foodResult.tryAnother": "Subukan iba",
  "foodResult.logMeal": "I-log ang pagkain",
  "foodResult.toast.tryAnother": "Subukan ang ibang larawan upang i-refine.",
  "foodResult.toast.couldnt": "Hindi na-refine. Ipinapakita ang orihinal.",
  "foodResult.toast.refined": "Naayos.",
  "foodResult.toast.logged": "Na-log.",
  "foodResult.toast.historyOff":
    "Naka-off ang meal history — buksan ito sa profile para makapag-log.",
  "foodResult.safety":
    "Tantya lang ang macros. Tiyakin sa restaurant kung mahigpit ang layunin.",

  "menuResult.menuSuffix": "menu",
  "menuResult.translatingTo": "Isinasalin sa",
  "menuResult.localEtiquette": "Lokal na etika",
  "menuResult.topPicks": "Mga rekomendasyon",
  "menuResult.whyItFits": "Bakit bagay",
  "menuResult.estUnavailable": "Walang tantya",
  "menuResult.sayToServer": "Sabihin sa server",
  "menuResult.showAll": "Ipakita lahat",
  "menuResult.hide": "Itago",
  "menuResult.phrasesToSay": "Mga parirala",
  "menuResult.copy": "Kopyahin",
  "menuResult.copied": "Nakopya",
  "menuResult.copyError": "Hindi makopya sa clipboard.",
  "menuResult.tryAnother": "Subukan ibang menu",
  "menuResult.safety":
    "Maaaring i-flag ng Forager ang panganib, pero tiyakin ang allergens at paghahanda sa restaurant.",

  "rec.topPick": "Pinakaunang pili",
  "rec.viewMenu": "Tingnan menu",
  "rec.orderThis": "I-order ito",
  "rec.estPrefix": "tantya",
  "rec.why": "Bakit",
  "rec.tradeoffs": "Mga trade-off",
  "rec.openInMaps": "Buksan sa Maps",

  "macros.calories": "Calories",
  "macros.protein": "Protein",
  "macros.carbs": "Carbs",
  "macros.fat": "Fat",
  "macros.medium": "Macros",

  "time.open24h": "Bukas 24 oras ngayon",
  "time.closedToday": "Sarado ngayon",
  "time.closesIn": "Magsasara sa",
  "time.openCloses": "Bukas · sara",
  "time.closedOpens": "Sarado · bukas",
  "time.unavailable": "Walang oras na alam",

  "demoBanner.default":
    "Demo data — offline ang backend. Gumagana pa rin ang buong flow.",

  "results.safety":
    "Best-effort lang ang flag ng allergen. Tiyakin sa restaurant bago mag-order kung mahigpit ang restriksyon.",
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

  "scan.toggle.snapMeal": "Фото блюда",
  "scan.toggle.translateMenu": "Перевод меню",

  "scan.food.eyebrow": "Сканировать",
  "scan.food.heading": "Сфотографируй блюдо",
  "scan.food.subtitle":
    "Мы определим блюдо, оценим макросы и подскажем, как сохранить.",
  "scan.food.helperPrimary": "Сделай или загрузи фото",
  "scan.food.helperSecondary":
    "Лучший результат при хорошем свете и видимой целиком тарелке.",
  "scan.food.loading": "Распознаём ваше блюдо…",
  "scan.food.loadingDetail": "Определяем ингредиенты и оцениваем макросы.",
  "scan.food.errorAnalyze": "Не удалось проанализировать изображение.",
  "scan.food.errorFailed": "Не удалось проанализировать. Показаны демо-данные.",

  "scan.menu.eyebrow": "Сканировать",
  "scan.menu.heading": "Перевести меню",
  "scan.menu.subtitle":
    "Переведём меню, отметим аллергены и ранжируем блюда — плюс фразы для официанта.",
  "scan.menu.helperPrimary": "Сделай или загрузи фото",
  "scan.menu.helperSecondary":
    "Помести меню целиком в кадр, даже если размыто — Forager постарается.",
  "scan.menu.loading": "Перевожу и ранжирую блюда…",
  "scan.menu.loadingDetail": "Читаю меню и изучаю местный этикет.",
  "scan.menu.errorAnalyze": "Не удалось перевести меню.",
  "scan.menu.errorFailed": "Не удалось перевести. Показаны демо-данные.",

  "capture.camera": "Камера",
  "capture.upload": "Загрузить",
  "capture.processing":
    "Обрабатываю изображение… после завершения можно загрузить ещё.",
  "capture.tip":
    "Совет: фото меню целиком с чёткими ценами даёт лучший результат.",
  "capture.analyzing": "Анализирую…",
  "capture.uploadPreview": "Превью",

  "foodResult.matchSuffix": "совпадение",
  "foodResult.likelyIngredients": "Вероятные ингредиенты",
  "foodResult.followup.heading": "Несколько уточнений",
  "foodResult.followup.note": "Это уточнит оценку макросов.",
  "foodResult.refining": "Уточняю…",
  "foodResult.refine": "Уточнить оценку",
  "foodResult.estimatedMacros": "Оценочные макросы",
  "foodResult.howToLog": "Как сохранить",
  "foodResult.tweakNext": "В следующий раз",
  "foodResult.tryAnother": "Другое фото",
  "foodResult.logMeal": "Сохранить блюдо",
  "foodResult.toast.tryAnother": "Попробуй другое фото для уточнения.",
  "foodResult.toast.couldnt": "Не удалось уточнить. Показана исходная оценка.",
  "foodResult.toast.refined": "Уточнено.",
  "foodResult.toast.logged": "Сохранено.",
  "foodResult.toast.historyOff":
    "История блюд выключена — включите в профиле, чтобы сохранять.",
  "foodResult.safety":
    "Макросы — оценка. При строгой цели уточняйте у ресторана.",

  "menuResult.menuSuffix": "меню",
  "menuResult.translatingTo": "Перевод на",
  "menuResult.localEtiquette": "Местный этикет",
  "menuResult.topPicks": "Лучшее для тебя",
  "menuResult.whyItFits": "Почему подходит",
  "menuResult.estUnavailable": "Оценка нет",
  "menuResult.sayToServer": "Скажи официанту",
  "menuResult.showAll": "Показать всё",
  "menuResult.hide": "Скрыть",
  "menuResult.phrasesToSay": "Полезные фразы",
  "menuResult.copy": "Копировать",
  "menuResult.copied": "Скопировано",
  "menuResult.copyError": "Не удалось скопировать.",
  "menuResult.tryAnother": "Другое меню",
  "menuResult.safety":
    "Forager помечает риски, но проверяйте аллергены и приготовление в ресторане.",

  "rec.topPick": "Лучший выбор",
  "rec.viewMenu": "Меню",
  "rec.orderThis": "Заказать это",
  "rec.estPrefix": "оценка",
  "rec.why": "Почему",
  "rec.tradeoffs": "Компромиссы",
  "rec.openInMaps": "Открыть в Картах",

  "macros.calories": "Калории",
  "macros.protein": "Белки",
  "macros.carbs": "Углеводы",
  "macros.fat": "Жиры",
  "macros.medium": "Макросы",

  "time.open24h": "Открыто круглосуточно",
  "time.closedToday": "Сегодня закрыто",
  "time.closesIn": "Закроется через",
  "time.openCloses": "Открыто · закрытие",
  "time.closedOpens": "Закрыто · откроется",
  "time.unavailable": "Часы недоступны",

  "demoBanner.default":
    "Демо-данные — бэкенд офлайн. Поток работает целиком.",

  "results.safety":
    "Пометки об аллергенах — приблизительные. Перед заказом уточняйте в ресторане при строгой диете.",
};

export const I18N: Record<LanguageCode, Dict> = { en, es, ja, zh, tl, ru };

export function translate(lang: LanguageCode, key: I18nKey): string {
  return I18N[lang]?.[key] ?? I18N.en[key] ?? key;
}
