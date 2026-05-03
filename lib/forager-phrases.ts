import type { LanguageCode } from "./forager-types";

export type Phrase = {
  /** English phrasing for the user's reference. */
  en: string;
  /** Phrase in the local language script. */
  local: string;
  /** Romanized / pronunciation aid (best effort; sometimes same as `local`). */
  phonetic: string;
};

export type PhraseSet = {
  vegetarianRecommend: Phrase;
  veganRecommend: Phrase;
  noPeanut: Phrase;
  noShellfish: Phrase;
  noNuts: Phrase;
  glutenFree: Phrase;
  dairyFree: Phrase;
  /** "Does this dish contain {X}?" — substitute the allergen at runtime. */
  containsAllergenTemplate: Phrase;
  water: Phrase;
  bill: Phrase;
  thankYou: Phrase;
};

const en: PhraseSet = {
  vegetarianRecommend: {
    en: "I'm vegetarian — what would you recommend?",
    local: "I'm vegetarian — what would you recommend?",
    phonetic: "I'm vegetarian — what would you recommend?",
  },
  veganRecommend: {
    en: "I'm vegan — what would you recommend?",
    local: "I'm vegan — what would you recommend?",
    phonetic: "I'm vegan — what would you recommend?",
  },
  noPeanut: {
    en: "I have a peanut allergy — is this safe?",
    local: "I have a peanut allergy — is this safe?",
    phonetic: "I have a peanut allergy — is this safe?",
  },
  noShellfish: {
    en: "I'm allergic to shellfish — is this safe?",
    local: "I'm allergic to shellfish — is this safe?",
    phonetic: "I'm allergic to shellfish — is this safe?",
  },
  noNuts: {
    en: "I'm allergic to tree nuts — does this contain any?",
    local: "I'm allergic to tree nuts — does this contain any?",
    phonetic: "I'm allergic to tree nuts — does this contain any?",
  },
  glutenFree: {
    en: "I need this gluten-free — is that possible?",
    local: "I need this gluten-free — is that possible?",
    phonetic: "I need this gluten-free — is that possible?",
  },
  dairyFree: {
    en: "I can't have dairy — does this contain any?",
    local: "I can't have dairy — does this contain any?",
    phonetic: "I can't have dairy — does this contain any?",
  },
  containsAllergenTemplate: {
    en: "Does this dish contain {X}?",
    local: "Does this dish contain {X}?",
    phonetic: "Does this dish contain {X}?",
  },
  water: { en: "Could I have water, please?", local: "Could I have water, please?", phonetic: "Could I have water, please?" },
  bill: { en: "Could I have the bill, please?", local: "Could I have the bill, please?", phonetic: "Could I have the bill, please?" },
  thankYou: { en: "Thank you — that was delicious!", local: "Thank you — that was delicious!", phonetic: "Thank you — that was delicious!" },
};

const es: PhraseSet = {
  vegetarianRecommend: {
    en: "I'm vegetarian — what would you recommend?",
    local: "Soy vegetariano. ¿Qué me recomienda?",
    phonetic: "Soy vegetariano. Keh meh reh-koh-mee-EHN-dah?",
  },
  veganRecommend: {
    en: "I'm vegan — what would you recommend?",
    local: "Soy vegano. ¿Qué me recomienda?",
    phonetic: "Soy veh-GAH-noh. Keh meh reh-koh-mee-EHN-dah?",
  },
  noPeanut: {
    en: "I have a peanut allergy — is this safe?",
    local: "Soy alérgico al cacahuate. ¿Esto es seguro?",
    phonetic: "Soy ah-LEHR-hee-koh al kah-kah-WAH-teh. EHS-toh ehs seh-GOO-roh?",
  },
  noShellfish: {
    en: "I'm allergic to shellfish — is this safe?",
    local: "Soy alérgico a los mariscos. ¿Esto es seguro?",
    phonetic: "Soy ah-LEHR-hee-koh ah los mah-REES-kohs. EHS-toh ehs seh-GOO-roh?",
  },
  noNuts: {
    en: "I'm allergic to tree nuts — does this contain any?",
    local: "Soy alérgico a los frutos secos. ¿Esto los contiene?",
    phonetic: "Soy ah-LEHR-hee-koh ah los FROO-tohs SEH-kohs. EHS-toh los kohn-tee-EH-neh?",
  },
  glutenFree: {
    en: "I need this gluten-free — is that possible?",
    local: "¿Puede ser sin gluten?",
    phonetic: "PWEH-deh sehr seen GLOO-tehn?",
  },
  dairyFree: {
    en: "I can't have dairy — does this contain any?",
    local: "No puedo comer lácteos. ¿Esto los contiene?",
    phonetic: "Noh PWEH-doh koh-MEHR LAHK-teh-ohs. EHS-toh los kohn-tee-EH-neh?",
  },
  containsAllergenTemplate: {
    en: "Does this dish contain {X}?",
    local: "¿Este plato contiene {X}?",
    phonetic: "EHS-teh PLAH-toh kohn-tee-EH-neh {X}?",
  },
  water: { en: "Could I have water, please?", local: "¿Me trae agua, por favor?", phonetic: "Meh TRAH-eh AH-gwah, por fah-VOR?" },
  bill: { en: "Could I have the bill, please?", local: "La cuenta, por favor.", phonetic: "Lah KWEHN-tah, por fah-VOR." },
  thankYou: { en: "Thank you — that was delicious!", local: "¡Gracias, estuvo delicioso!", phonetic: "GRAH-syahs, ehs-TOO-voh deh-lee-SYOH-soh!" },
};

const ja: PhraseSet = {
  vegetarianRecommend: {
    en: "I'm vegetarian — what would you recommend?",
    local: "ベジタリアンです。おすすめは何ですか？",
    phonetic: "Bejitarian desu. Osusume wa nan desu ka?",
  },
  veganRecommend: {
    en: "I'm vegan — what would you recommend?",
    local: "ヴィーガンです。おすすめは何ですか？",
    phonetic: "Vīgan desu. Osusume wa nan desu ka?",
  },
  noPeanut: {
    en: "I have a peanut allergy — is this safe?",
    local: "ピーナッツアレルギーがあります。この料理は大丈夫ですか？",
    phonetic: "Pīnattsu arerugī ga arimasu. Kono ryōri wa daijōbu desu ka?",
  },
  noShellfish: {
    en: "I'm allergic to shellfish — is this safe?",
    local: "甲殻類アレルギーがあります。この料理は大丈夫ですか？",
    phonetic: "Kōkakurui arerugī ga arimasu. Kono ryōri wa daijōbu desu ka?",
  },
  noNuts: {
    en: "I'm allergic to tree nuts — does this contain any?",
    local: "ナッツアレルギーがあります。この料理にナッツは入っていますか？",
    phonetic: "Nattsu arerugī ga arimasu. Kono ryōri ni nattsu wa haitte imasu ka?",
  },
  glutenFree: {
    en: "I need this gluten-free — is that possible?",
    local: "グルテンフリーでお願いできますか？",
    phonetic: "Gurutenfurī de onegai dekimasu ka?",
  },
  dairyFree: {
    en: "I can't have dairy — does this contain any?",
    local: "乳製品が食べられません。この料理に入っていますか？",
    phonetic: "Nyūseihin ga taberaremasen. Kono ryōri ni haitte imasu ka?",
  },
  containsAllergenTemplate: {
    en: "Does this dish contain {X}?",
    local: "この料理に{X}は入っていますか？",
    phonetic: "Kono ryōri ni {X} wa haitte imasu ka?",
  },
  water: { en: "Could I have water, please?", local: "お水をください。", phonetic: "Omizu o kudasai." },
  bill: { en: "Could I have the bill, please?", local: "お会計をお願いします。", phonetic: "Okaikei o onegai shimasu." },
  thankYou: { en: "Thank you — that was delicious!", local: "ごちそうさまでした！", phonetic: "Gochisōsama deshita!" },
};

const zh: PhraseSet = {
  vegetarianRecommend: {
    en: "I'm vegetarian — what would you recommend?",
    local: "我吃素，您推荐什么？",
    phonetic: "Wǒ chī sù, nín tuījiàn shénme?",
  },
  veganRecommend: {
    en: "I'm vegan — what would you recommend?",
    local: "我吃纯素，您推荐什么？",
    phonetic: "Wǒ chī chún sù, nín tuījiàn shénme?",
  },
  noPeanut: {
    en: "I have a peanut allergy — is this safe?",
    local: "我对花生过敏，这道菜可以吃吗？",
    phonetic: "Wǒ duì huāshēng guòmǐn, zhè dào cài kěyǐ chī ma?",
  },
  noShellfish: {
    en: "I'm allergic to shellfish — is this safe?",
    local: "我对贝类过敏，这道菜安全吗？",
    phonetic: "Wǒ duì bèilèi guòmǐn, zhè dào cài ānquán ma?",
  },
  noNuts: {
    en: "I'm allergic to tree nuts — does this contain any?",
    local: "我对坚果过敏，这道菜里有坚果吗？",
    phonetic: "Wǒ duì jiānguǒ guòmǐn, zhè dào cài lǐ yǒu jiānguǒ ma?",
  },
  glutenFree: {
    en: "I need this gluten-free — is that possible?",
    local: "可以做无麸质的吗？",
    phonetic: "Kěyǐ zuò wú fūzhì de ma?",
  },
  dairyFree: {
    en: "I can't have dairy — does this contain any?",
    local: "我不能吃乳制品，这道菜里有吗？",
    phonetic: "Wǒ bùnéng chī rǔ zhìpǐn, zhè dào cài lǐ yǒu ma?",
  },
  containsAllergenTemplate: {
    en: "Does this dish contain {X}?",
    local: "这道菜里有{X}吗？",
    phonetic: "Zhè dào cài lǐ yǒu {X} ma?",
  },
  water: { en: "Could I have water, please?", local: "请给我一杯水。", phonetic: "Qǐng gěi wǒ yībēi shuǐ." },
  bill: { en: "Could I have the bill, please?", local: "请买单。", phonetic: "Qǐng mǎidān." },
  thankYou: { en: "Thank you — that was delicious!", local: "谢谢，非常好吃！", phonetic: "Xièxie, fēicháng hǎochī!" },
};

const tl: PhraseSet = {
  vegetarianRecommend: {
    en: "I'm vegetarian — what would you recommend?",
    local: "Vegetarian po ako — ano ang masasabi niyong rekomendasyon?",
    phonetic: "Veh-jeh-TAH-ree-an po ah-koh — ah-noh ahng mah-sah-sah-BEE nyong reh-koh-men-DAH-syon?",
  },
  veganRecommend: {
    en: "I'm vegan — what would you recommend?",
    local: "Vegan po ako — ano ang inyong rekomendasyon?",
    phonetic: "VEH-gan po ah-koh — ah-noh ahng een-YONG reh-koh-men-DAH-syon?",
  },
  noPeanut: {
    en: "I have a peanut allergy — is this safe?",
    local: "Allergic po ako sa mani — ligtas po ba ito?",
    phonetic: "Al-LER-jik po ah-koh sah MAH-nee — LIG-tas po bah ee-toh?",
  },
  noShellfish: {
    en: "I'm allergic to shellfish — is this safe?",
    local: "Allergic po ako sa hipon at iba pang shellfish — ligtas po ba ito?",
    phonetic: "Al-LER-jik po ah-koh sah HEE-pon aht ee-bah pahng shell-fish — LIG-tas po bah ee-toh?",
  },
  noNuts: {
    en: "I'm allergic to tree nuts — does this contain any?",
    local: "Allergic po ako sa mga nuts — may laman po bang nuts ito?",
    phonetic: "Al-LER-jik po ah-koh sah mga nuts — meigh LAH-mahn po bahng nuts ee-toh?",
  },
  glutenFree: {
    en: "I need this gluten-free — is that possible?",
    local: "Pwede po bang walang gluten?",
    phonetic: "PWEH-deh po bahng wah-LAHNG gluten?",
  },
  dairyFree: {
    en: "I can't have dairy — does this contain any?",
    local: "Hindi po ako pwede sa dairy — may laman po bang gatas ito?",
    phonetic: "Heen-DEE po ah-koh PWEH-deh sah dairy — meigh LAH-mahn po bahng GAH-tas ee-toh?",
  },
  containsAllergenTemplate: {
    en: "Does this dish contain {X}?",
    local: "May {X} po ba sa lutuing ito?",
    phonetic: "Meigh {X} po bah sah loo-TOO-ing ee-toh?",
  },
  water: { en: "Could I have water, please?", local: "Pwede po bang tubig?", phonetic: "PWEH-deh po bahng TOO-big?" },
  bill: { en: "Could I have the bill, please?", local: "Bill po, paki.", phonetic: "Bill po, pah-KEE." },
  thankYou: { en: "Thank you — that was delicious!", local: "Salamat po, ang sarap!", phonetic: "Sah-LAH-mat po, ahng sah-RAHP!" },
};

const ru: PhraseSet = {
  vegetarianRecommend: {
    en: "I'm vegetarian — what would you recommend?",
    local: "Я вегетарианец. Что вы порекомендуете?",
    phonetic: "Ya vegetarianets. Chto vy porekomenduyete?",
  },
  veganRecommend: {
    en: "I'm vegan — what would you recommend?",
    local: "Я веган. Что вы порекомендуете?",
    phonetic: "Ya vegan. Chto vy porekomenduyete?",
  },
  noPeanut: {
    en: "I have a peanut allergy — is this safe?",
    local: "У меня аллергия на арахис. Это блюдо безопасно?",
    phonetic: "U menya allergiya na arakhis. Eto blyudo bezopasno?",
  },
  noShellfish: {
    en: "I'm allergic to shellfish — is this safe?",
    local: "У меня аллергия на морепродукты. Это блюдо безопасно?",
    phonetic: "U menya allergiya na moreprodukty. Eto blyudo bezopasno?",
  },
  noNuts: {
    en: "I'm allergic to tree nuts — does this contain any?",
    local: "У меня аллергия на орехи. В этом есть орехи?",
    phonetic: "U menya allergiya na orekhi. V etom yest orekhi?",
  },
  glutenFree: {
    en: "I need this gluten-free — is that possible?",
    local: "Можно без глютена?",
    phonetic: "Mozhno bez glyutena?",
  },
  dairyFree: {
    en: "I can't have dairy — does this contain any?",
    local: "Я не могу есть молочное. Здесь есть молочные продукты?",
    phonetic: "Ya ne mogu yest molochnoye. Zdes yest molochnyye produkty?",
  },
  containsAllergenTemplate: {
    en: "Does this dish contain {X}?",
    local: "В этом блюде есть {X}?",
    phonetic: "V etom blyude yest {X}?",
  },
  water: { en: "Could I have water, please?", local: "Можно воды, пожалуйста?", phonetic: "Mozhno vody, pozhaluysta?" },
  bill: { en: "Could I have the bill, please?", local: "Счёт, пожалуйста.", phonetic: "Schyot, pozhaluysta." },
  thankYou: { en: "Thank you — that was delicious!", local: "Спасибо, было очень вкусно!", phonetic: "Spasibo, bylo ochen vkusno!" },
};

export const PHRASES: Record<LanguageCode, PhraseSet> = { en, es, ja, zh, tl, ru };

/** Build a phrase list keyed off the user's profile (allergens + diet rules). */
export function phrasesForProfile(opts: {
  language: LanguageCode;
  allergens: string[];
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
}): Phrase[] {
  const set = PHRASES[opts.language] ?? PHRASES.en;
  const out: Phrase[] = [];

  if (opts.vegan) out.push(set.veganRecommend);
  else if (opts.vegetarian) out.push(set.vegetarianRecommend);

  const lowered = opts.allergens.map((a) => a.toLowerCase());
  if (lowered.some((a) => a.includes("peanut"))) out.push(set.noPeanut);
  if (lowered.some((a) => a.includes("shellfish") || a.includes("shrimp") || a.includes("crab"))) {
    out.push(set.noShellfish);
  }
  if (lowered.some((a) => a.includes("nut") && !a.includes("peanut"))) out.push(set.noNuts);

  if (opts.glutenFree) out.push(set.glutenFree);
  if (opts.dairyFree) out.push(set.dairyFree);

  out.push(set.water, set.bill, set.thankYou);
  return out;
}
