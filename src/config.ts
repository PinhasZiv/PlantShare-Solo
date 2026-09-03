// ============================================================================
//  ההגדרות היחידות שצריך למלא באפליקציה עצמה.
//
//  שני הערכים האלה בטוחים לפרסום. הם ממילא נכללים בקוד שנשלח לדפדפן, וכל
//  טבלה במסד הנתונים מוגנת ב-Row Level Security - המפתח לבדו לא נותן גישה
//  לשום דבר. אל תשים כאן לעולם את המפתח service_role.
//
//  איפה מוצאים אותם: Supabase → Project Settings → Data API
// ============================================================================

/** Project URL, למשל https://abcdefghijklmnop.supabase.co */
export const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE'

/** המפתח הציבורי (anon / publishable), מתחיל ב-eyJ או ב-sb_publishable_ */
export const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE'

// ----------------------------------------------------------------------------
// מכאן והלאה כבר מוגדר. אין צורך לגעת.
// ----------------------------------------------------------------------------

/**
 * המפתח הציבורי של ההתראות (VAPID). החצי הפרטי שלו יושב במסד הנתונים ולא
 * בקוד. שינוי של המפתח הזה מבטל את כל המנויים הקיימים להתראות.
 */
export const VAPID_PUBLIC_KEY =
  'BAWb5UI23OgtJM1NY3kNB21M92VrFOYu7RKFW3A30ZBDc1jM1MrgPsDYBsRSJhMlbClvlbVlKkjJmt3PN6Er2ns'

/** נשאר false עד שממלאים את שני הערכים למעלה. */
export const isConfigured =
  !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_')
