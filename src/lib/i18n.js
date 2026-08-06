/**
 * Tiny i18n helper — EN + ES (+ UR stubs). No i18next dependency.
 */
const catalogs = {
  en: {
    "app.tagline": "Video calls at the speed of light",
    "home.create": "Create meeting",
    "home.join": "Join meeting",
    "room.softCap": "Room is near mesh capacity. Video may degrade.",
    "room.softCapHost": "Mesh soft-cap reached — ask fewer people to enable video.",
    "secret.title": "SecretMeet",
    "secret.find": "Find a random match",
    "secret.report": "Report",
    "secret.block": "Block",
  },
  es: {
    "app.tagline": "Videollamadas a la velocidad de la luz",
    "home.create": "Crear reunión",
    "home.join": "Unirse a la reunión",
    "room.softCap": "La sala está cerca de la capacidad mesh. El video puede degradarse.",
    "room.softCapHost": "Límite mesh alcanzado — pide que menos personas activen el video.",
    "secret.title": "SecretMeet",
    "secret.find": "Buscar coincidencia aleatoria",
    "secret.report": "Reportar",
    "secret.block": "Bloquear",
  },
  ur: {
    "app.tagline": "روشنی کی رفتار سے ویڈیو کالز",
    "home.create": "میٹنگ بنائیں",
    "home.join": "میٹنگ میں شامل ہوں",
    "room.softCap": "کمرہ میش صلاحیت کے قریب ہے۔ ویڈیو کمزور ہو سکتی ہے۔",
    "room.softCapHost": "میش حد پوری — کم لوگوں سے ویڈیو آن رکھیں۔",
    "secret.title": "SecretMeet",
    "secret.find": "بے ترتیب مماثلت تلاش کریں",
    "secret.report": "رپورٹ",
    "secret.block": "بلاک",
  },
};

let locale = (typeof localStorage !== "undefined" && localStorage.getItem("qm_locale")) || "en";

export function setLocale(next) {
  if (!catalogs[next]) return;
  locale = next;
  try {
    localStorage.setItem("qm_locale", next);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = next === "ur" ? "ur" : next;
  }
}

export function getLocale() {
  return locale;
}

export function t(key, fallback) {
  const cat = catalogs[locale] || catalogs.en;
  return cat[key] || catalogs.en[key] || fallback || key;
}

export function availableLocales() {
  return Object.keys(catalogs);
}
