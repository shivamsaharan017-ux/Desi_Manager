const languageAliases = {
  milk: /(milk|doodh|दूध|দুধ|பால்|పాలు|દૂધ|ಹಾಲು|പാൽ|ਦੁੱਧ|دودھ)/iu,
  tea: /(tea|chai|चाय|চা|தேநீர்|టీ|ચા|ಚಹಾ|ചായ|ਚਾਹ|چائے)/iu,
  sugar: /(sugar|चीनी|চিনি|சர்க்கரை|చక్కెర|ખાંડ|ಸಕ್ಕರೆ|പഞ്ചസാര|ਖੰਡ|چینی)/iu,
  cups: /(cup|cups|कप|কাপ|கப்|కప్పులు|કપ|ಕಪ್|കപ്പ്|ਕੱਪ|کپ)/iu,
  biscuits: /(biscuit|biscuits|snack|बिस्कुट|নাস্তা|பிஸ்கட்|బిస్కెట్లు|બિસ્કિટ|ಬಿಸ್ಕತ್ತು|ബിസ്കറ്റ്|ਬਿਸਕੁਟ|بسکٹ)/iu,
};

const todayString = () => {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
};

const spokenNumberWords = new Map();
function addNumberWords(value, words) {
  for (const word of words.split(" ")) spokenNumberWords.set(word, value);
}
[
  [0, "zero शून्य"], [1, "one ek एक"], [2, "two do दो"], [3, "three teen tin तीन"],
  [4, "four char chaar चार"], [5, "five paanch panch पांच पाँच"], [6, "six chhe chhah छह छः"],
  [7, "seven saat सात"], [8, "eight aath आठ"], [9, "nine nau नौ"], [10, "ten das दस"],
  [11, "eleven gyarah ग्यारह"], [12, "twelve barah बारह"], [13, "thirteen terah तेरह"],
  [14, "fourteen chaudah चौदह"], [15, "fifteen pandrah पंद्रह पन्द्रह"], [16, "sixteen solah सोलह"],
  [17, "seventeen satrah सत्रह"], [18, "eighteen atharah अठारह"], [19, "nineteen unnis उन्नीस"],
  [20, "twenty bees बीस"], [21, "twentyone ikkis इक्कीस"], [22, "twentytwo bais बाईस"],
  [23, "twentythree teis तेईस"], [24, "twentyfour chaubees चौबीस"], [25, "twentyfive pachis पच्चीस"],
  [26, "twentysix chhabbees छब्बीस"], [27, "twentyseven sattais सत्ताईस"], [28, "twentyeight athais अट्ठाईस"],
  [29, "twentynine untis उनतीस"], [30, "thirty tees तीस"], [40, "forty chalis chaalis चालीस"],
  [50, "fifty pachas pachaas पचास"], [60, "sixty saath साठ"], [70, "seventy sattar सत्तर"],
  [80, "eighty assi अस्सी"], [90, "ninety nabbe नब्बे"], [100, "hundred sau सौ"],
  [1000, "thousand hazaar हजार हज़ार"], [100000, "lakh lac लाख"], [10000000, "crore करोड़"],
].forEach(([value, words]) => addNumberWords(value, words));

function parseSpokenNumber(value) {
  const tokens = String(value || "").toLocaleLowerCase().normalize("NFC").match(/[\p{L}\p{M}]+/gu) || [];
  let total = 0;
  let current = 0;
  let started = false;
  for (const token of tokens) {
    const number = spokenNumberWords.get(token);
    if (number === undefined) {
      if (!started) continue;
      if (["and", "aur", "और"].includes(token)) continue;
      break;
    }
    started = true;
    if (number === 100) current = (current || 1) * 100;
    else if (number >= 1000) {
      total += (current || 1) * number;
      current = 0;
    } else current += number;
  }
  return started ? total + current : null;
}

function extractVoiceDescription(text, customer) {
  const words = String(text || "").normalize("NFC").toLocaleLowerCase().match(/[\p{L}\p{M}'-]+/gu) || [];
  const customerWords = String(customer || "").normalize("NFC").toLocaleLowerCase().match(/[\p{L}\p{M}'-]+/gu) || [];
  const commandWords = new Set([
    "to", "for", "ko", "ne", "add", "write", "record", "put", "give", "gave", "credit", "udhaar", "udhar", "khata",
    "please", "rupee", "rupees", "rs", "rupaye", "rupya", "rupay", "and", "aur", "of", "mein", "me", "ka", "ki", "ke",
    "sale", "sales", "sold", "sell", "becha", "bechi", "bika", "biki",
    "liya", "liye", "diya", "diye", "de", "dena", "lena", "gaya", "gayi", "le", "likho", "likh", "laga", "kar", "do", "hai", "tha",
    "को", "ने", "रुपये", "रुपया", "रुपए", "पैसे", "और", "उधार", "उधर", "खाता", "बकाया", "लिखो", "लिख", "डालो", "कर", "दो", "है", "था", "के", "का", "की", "में", "लिए", "दिया", "दिए", "दे", "लेना", "देना", "गया", "गई", "बिक्री", "बेचा", "बेची", "बिका", "बिकी",
    "বাকি", "ধার", "খাতা", "கடன்", "అప్పు", "ઉધાર", "ಬಾಕಿ", "കടം", "ਉਧਾਰ", "ادھار",
  ]);
  const descriptionWords = [];
  for (let index = 0; index < words.length;) {
    const isCustomer = customerWords.length && customerWords.every((word, offset) => words[index + offset] === word);
    if (isCustomer) {
      index += customerWords.length;
      continue;
    }
    const word = words[index];
    if (!spokenNumberWords.has(word) && !commandWords.has(word)) descriptionWords.push(word);
    index += 1;
  }
  return descriptionWords.join(" ").slice(0, 240);
}


export function parseVoiceCommand(input, requestedIntent = "auto", inventory = []) {
  const text = String(input || "").trim().slice(0, 500);
  const intent = String(requestedIntent || "auto");
  if (!text) throw new Error("Say or type a short command first.");
  if (!["auto", "expense", "sale", "credit", "payment", "restock"].includes(intent)) throw new Error("Choose a valid record type.");
  const lower = text.toLocaleLowerCase();
  const decimalDigitStarts = [0x0030, 0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0de6, 0x0e50, 0x0ed0, 0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0, 0x10d30, 0x11066, 0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x11730, 0x118e0, 0x11950, 0x11c50, 0x11d50, 0x11da0, 0x16a60, 0x16ac0, 0x16b50, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e950];
  const numericText = text.replace(/\p{Nd}/gu, (digit) => {
    const codePoint = digit.codePointAt(0);
    const start = decimalDigitStarts.find((candidate) => codePoint >= candidate && codePoint <= candidate + 9);
    return start === undefined ? digit : String(codePoint - start);
  });

  if (intent === "restock" || (intent === "auto" && /(order|reorder|restock|buy|mangao|ऑर्डर|मंगवा|মাঙ্গান|ஆர்டர்|ఆర్డర్|ઓર્ડર|ಆರ್ಡರ್|ഓർഡർ|ਆਰਡਰ|آرڈر)/iu.test(lower))) {
    const quantityMatch = numericText.match(/(\d[\d,]*(?:\.\d{1,2})?)/);
    const quantity = quantityMatch ? Number(quantityMatch[1].replaceAll(",", "")) : parseSpokenNumber(text);
    if (!quantity) throw new Error("Tell me how many items you need, like “order 20 milk packets”.");
    const item = inventory.find((entry) => (languageAliases[entry.id] || new RegExp(entry.name, "iu")).test(lower));
    if (!item) throw new Error("I couldn’t identify the stock item. Try milk, tea, sugar, cups, or biscuits.");
    return ({ type: "restock", itemId: item.id, itemName: item.name, supplier: item.supplier, quantity, unit: item.unit });
  }

  const amountMatch = numericText.match(/(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replaceAll(",", "")) : parseSpokenNumber(text);
  if (amount === null || amount === undefined) throw new Error("Include the amount as digits or say a supported English or Hindi number word.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("That amount does not look right. Please try again.");

  const isCredit = intent === "credit" || (intent === "auto" && (/(udhaar|udhar|credit|khata|उधार|खाता|বাকি|ধার|கடன்|అప్పు|ઉધાર|ಬಾಕಿ|കടം|ਉਧਾਰ|ادھار)/iu.test(lower) || /(?:ko|को).*(?:diya|diye|दिया|दिए)/iu.test(lower)));
  const isPayment = intent === "payment" || (intent === "auto" && !isCredit && /(paid|payment|received|jama|जमा|वापस|लौटाया|लौटाए|(?:ne|ने).*(?:de\s+diya|diya|diye|दे\s+दिया|दिया|दिए)|দিয়েছে|পেয়েছে|ফেরত|செலுத்த|கட்டிவிட்ட|திருப்பி|చెల్లించ|చెల్లించారు|తిరిగి|ચૂકવ|પરત|ಪಾವತ|ಹಿಂತಿರುಗಿ|അടച്ചു|തിരികെ|ਭੁਗਤਾਨ|ਵਾਪਸ|ادا|واپس)/iu.test(lower));
  const isMisheardHindiCredit = intent === "auto" && /(?:ko|को).*(?:उधर)/iu.test(lower);
  const isCreditCommand = isCredit || isMisheardHindiCredit;
  const salePattern = /(\bsale\b|\bsales\b|\bsold\b|\bsell\b|बिक्री|बेचा|बेची|बिका|बिकी|বিক্রি|விற்ற|అమ్మి|విక్రయ|વેચ|ಮಾರಾಟ|വിൽപ്പന|ਵੇਚਿਆ|فروخت)/iu;
  const isSale = intent === "sale" || (intent === "auto" && !isCreditCommand && salePattern.test(lower));
  if (isSale) {
    const label = extractVoiceDescription(text, "") || "Counter sale";
    return ({ type: "sale", label: label.slice(0, 100), amount, date: todayString() });
  }
  const isPaymentCommand = isPayment && !isMisheardHindiCredit;
  if (isPaymentCommand || isCreditCommand) {
    const customerMatch = text.match(/([\p{L}][\p{L}\p{M}'-]*(?:\s+[\p{L}][\p{L}\p{M}'-]*){0,2})\s+(?:ko|को|ne|ने|paid|has\s+paid|jama|जमा)(?=\s|$)/iu)
      || text.match(/(?:^|\s)(?:credit|udhaar|udhar|khata|उधार|खाता)?\s*(?:for|to)\s+([\p{L}][\p{L}\p{M}'-]*(?:\s+[\p{L}][\p{L}\p{M}'-]*){0,2})/iu)
      || text.match(/^([\p{L}][\p{L}\p{M}'-]{1,30})\s+/u);
    const customer = customerMatch ? (customerMatch[1] || customerMatch[2]).trim() : "";
    const note = extractVoiceDescription(text, customer);
    return ({
      type: isPaymentCommand ? "payment" : "credit",
      customer,
      amount,
      title: isPaymentCommand ? "Payment received" : "Udhaar added",
      note,
      description: note,
      needsCustomer: !customer,
    });
  }

  const rules = [
    ["rent", /(rent|kiraya|किराया|ভাড়া|வாடகை|అద్దె|ભાડું|ಬಾಡಿಗೆ|വാടക|ਕਿਰਾਇਆ|کرایہ)/iu, "Shop rent"],
    ["stock", /(milk|doodh|दूध|দুধ|பால்|పాలు|tea|chai|चाय|চা|தேநீர்|sugar|चीनी|চিনি|சர்க்கரை|stock|samaan|सामान|સામાન|ಬೇಡಿಕೆ|കച്ചവടസാധനം)/iu, "Stock purchase"],
    ["wages", /(salary|wage|staff|worker|mazdoori|तनख्वाह|मजदूरी|वेतन|বেতন|মজুরি|சம்பளம்|జీతం|વેતન|ಸಂಬಳ|ശമ്പളം|ਤਨਖਾਹ|تنخواہ)/iu, "Staff wages"],
    ["utilities", /(electric|bijli|बिजली|বিদ্যুৎ|மின்சாரம்|విద్యుత్|વીજળી|ವಿದ್ಯುತ್|വൈദ്യുതി|ਬਿਜਲੀ|بجلی|water|paani|पानी|পানি|தண்ணீர்|నీరు)/iu, "Utility bill"],
    ["delivery", /(delivery|fuel|petrol|diesel|transport|ईंधन|পেট্রোল|எரிபொருள்|ఇంధనం|પેટ્રોલ|ಇಂಧನ|ഇന്ധനം|ਪੈਟਰੋਲ|پٹرول)/iu, "Delivery expense"],
    ["maintenance", /(repair|maintenance|fix|मरम्मत|রিপেয়ার|பழுது|మరమ్మత్తు|સમારકામ|ದುರಸ್ತಿ|അറ്റകുറ്റപ്പണി|ਮੁਰੰਮਤ|مرمت)/iu, "Shop repair"],
  ];
  const matched = rules.find(([, pattern]) => pattern.test(lower));
  const category = matched ? matched[0] : "other";
  const spokenTitle = text.replace(/\p{Nd}/gu, "").trim();
  let title = matched ? matched[2] : spokenTitle.slice(0, 100) || "Shop expense";
  if (languageAliases.milk.test(lower)) title = "Milk purchase";
  else if (languageAliases.tea.test(lower)) title = "Tea supplies";
  else if (languageAliases.sugar.test(lower)) title = "Sugar purchase";
  else if (languageAliases.biscuits.test(lower)) title = "Snacks and bakery stock";
  else if (/(electric|bijli|बिजली|বিদ্যুৎ|மின்சாரம்|విద్యుత్)/iu.test(lower)) title = "Electricity bill";

  return ({ type: "expense", category, title, amount, date: todayString(), method: "cash", vendor: "", note: "Added by voice" });
}
