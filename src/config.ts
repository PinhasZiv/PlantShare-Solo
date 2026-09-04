// ============================================================================
//  ההגדרות היחידות שצריך למלא באפליקציה עצמה.
//
//  שני הערכים האלה בטוחים לפרסום. הם ממילא נכללים בקוד שנשלח לדפדפן, וכל
//  טבלה במסד הנתונים מוגנת ב-Row Level Security - המפתח לבדו לא נותן גישה
//  לשום דבר. אל תשים כאן לעולם את המפתח service_role.
//
//  איפה מוצאים אותם: Supabase → Project Settings → Data API
// ============================================================================

/**
 * Project URL - הכתובת הבסיסית בלבד, בלי שום נתיב בסופה.
 * למשל https://abcdefghijklmnop.supabase.co
 *
 * בדף Data API של Supabase יש שתי שורות דומות: "Project URL" למעלה, ומתחתיה
 * "REST API URL" שכבר מסתיימת ב-/rest/v1/. מעתיקים את השורה הראשונה בלבד -
 * supabase-js מוסיף את הנתיבים בעצמו, וכתובת עם /rest/v1/ בסוף שוברת גם את
 * ההתחברות וגם את כל הקריאות למסד הנתונים.
 */
export const SUPABASE_URL = 'https://qskcwqknqwswqfnbmbxf.supabase.co'

/** המפתח הציבורי (anon / publishable), מתחיל ב-eyJ או ב-sb_publishable_ */
export const SUPABASE_ANON_KEY = 'sb_publishable_UasoX0Oftpo4lsUrOxY4ZA_o8yYMxwy'

// ----------------------------------------------------------------------------
// מכאן והלאה כבר מוגדר. אין צורך לגעת.
// ----------------------------------------------------------------------------

/**
 * המפתח הציבורי של ההתראות (VAPID). החצי הפרטי שלו יושב במסד הנתונים ולא
 * בקוד. שינוי של המפתח הזה מבטל את כל המנויים הקיימים להתראות.
 */
export const VAPID_PUBLIC_KEY =
  'BDJiNMmEeXk34oQvE1RjsVvlHjeJxM1aBKBhAwj2Idk9ePLvmCqcHT27VIkVh_roDRlE2JTgHCiffN4joeAXqjc'

/** נשאר false עד שממלאים את שני הערכים למעלה. */
export const isConfigured =
  !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_')
