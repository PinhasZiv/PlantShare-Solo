// המילון העברי, והצורה שכל מילון אחר חייב להתאים לה.
//
// הערה על ניסוח: העברית כאן נמנעת מפניות בגוף שני מוטות מין. במקום
// "הוסף צמח" - "הוספת צמח", במקום "שמור" - "שמירה". זה גם נייטרלי וגם
// הצורה המקובלת בממשקים בעברית.
//
// אין כאן `as const` בכוונה: הטיפוס Strings נגזר מהאובייקט הזה, ולו היו
// כאן טיפוסים ליטרליים היה המילון האנגלי נדרש להכיל בדיוק את אותן
// מחרוזות. בלי זה הוא נדרש רק לאותו מבנה, וזה מה שאנחנו רוצים לאכוף.

import { days, plants as plantCount } from '../format'

export const he = {
  appName: 'PlantShare',

  nav: {
    tonight: 'הערב',
    plants: 'צמחים',
    space: 'מרחב',
    settings: 'הגדרות',
  },

  common: {
    cancel: 'ביטול',
    save: 'שמירה',
    saving: 'שומר...',
    working: 'רגע...',
    loading: 'טוען...',
    tryAgain: 'ניסיון נוסף',
    somethingWrong: 'משהו השתבש',
    undo: 'ביטול',
  },

  signIn: {
    tagline: 'רשימת השקיה משותפת לצמחים שבבית. אחד משקה, כל השאר רואים שזה נעשה.',
    button: 'כניסה עם Google',
    opening: 'פותח את Google...',
    privacy:
      'חשבון Google משמש רק כדי לזהות אותך ולהציג את שמך למי שחולק איתך מרחב. שום דבר אחר לא נשמר ולא נשלח.',
  },

  onboarding: {
    title: 'עוד רגע מסיימים',
    lede: 'הצמחים חיים בתוך מרחב משותף. אפשר ליצור אחד לבית, או להצטרף למרחב שכבר קיים.',
  },

  tonight: {
    titleActive: 'הערב',
    titleDone: 'הכול בוצע',
    needWater: (n: number) => `${plantCount(n, 'he')} ${n === 1 ? 'ממתין' : 'ממתינים'} להשקיה`,
    allWatered: 'כל מה שהיה להשקות היום כבר הושקה.',
    nothingDue: 'אין צמחים להשקיה היום.',
    groupLate: 'באיחור',
    groupDue: 'להשקיה היום',
    groupDone: 'הושקו הערב',
    nextUp: (what: string) => `הבא בתור: ${what}`,
    nothingScheduled: 'אין שום דבר מתוזמן',
    emptyTitle: 'עוד אין צמחים',
    emptyBody: 'מוסיפים את הראשון, ו-PlantShare יתחיל להזכיר לכולם במרחב.',
    addPlant: 'הוספת צמח',
    watered: (name: string) => `${name} הושקה.`,
  },

  plant: {
    water: 'השקיתי',
    waterAria: (name: string) => `סימון ${name} כמושקה`,
    badgeLate: (n: number) => `איחור של ${days(n, 'he')}`,
    badgeDue: 'הערב',
    badgeDone: 'בוצע',
    wateredBy: (who: string) => `הושקה על ידי ${who}`,
    wateredByYou: 'הושקה על ידך',
    nextIn: (when: string) => `הבא ${when}`,
    dueOn: (date: string) => `יעד: ${date}`,
    nextOn: (date: string) => `הבא: ${date}`,
    someoneElse: 'מישהו אחר',
  },

  plantForm: {
    titleNew: 'צמח חדש',
    titleEdit: 'עריכת צמח',
    name: 'שם',
    namePlaceholder: 'בזיליקום בחלון המטבח',
    waterEvery: 'תדירות השקיה',
    presets: {
      daily: 'כל יום',
      threeDays: 'כל 3 ימים',
      weekly: 'פעם בשבוע',
      twoWeeks: 'פעם בשבועיים',
      monthly: 'פעם בחודש',
    },
    daysUnit: 'ימים',
    daysAria: 'מספר הימים בין השקיה להשקיה',
    firstWatering: 'ההשקיה הראשונה',
    nextWatering: 'ההשקיה הבאה',
    notes: 'הערות (לא חובה)',
    notesPlaceholder: 'חצי כוס, בלי צלוחית',
    add: 'הוספת צמח',
    delete: 'מחיקת הצמח',
    confirmDelete: (name: string) => `למחוק את ${name}? הצמח יימחק אצל כל מי שנמצא במרחב.`,
    errorNoName: 'צריך לתת לצמח שם.',
    errorPeriod: 'תדירות ההשקיה צריכה להיות בין יום אחד ל-365 ימים.',
  },

  plants: {
    empty: 'אין עדיין צמחים במרחב הזה.',
    emptyBody: 'מוסיפים צמח עם שם ועם תדירות ההשקיה שלו.',
    addFirst: 'הוספת הצמח הראשון',
    count: (n: number) => plantCount(n, 'he'),
    addAria: 'הוספת צמח',
    added: (name: string) => `${name} נוסף.`,
    deleted: 'הצמח נמחק.',
  },

  space: {
    title: 'מרחב',
    subtitle: 'כל מי שנמצא כאן חולק את אותה רשימת השקיה.',
    rename: 'שינוי שם',
    nameAria: 'שם המרחב',
    inviteTitle: 'הזמנת אנשים',
    inviteBody: 'הם פותחים את הקישור, נכנסים עם Google, ומקלידים את הקוד הזה.',
    inviteCodeAria: 'קוד הזמנה',
    share: 'שליחת הזמנה',
    copied: 'ההזמנה הועתקה.',
    codeIs: (code: string) => `קוד ההזמנה: ${code}`,
    shareMessage: (name: string, url: string, code: string) =>
      `הצטרפו לרשימת ההשקיה "${name}" ב-PlantShare.\n\nנכנסים ל-${url} ומקלידים את הקוד: ${code}`,
    shareTitle: 'הזמנה ל-PlantShare',
    members: (n: number) => `חברים (${n})`,
    memberFallback: 'חבר',
    // בגוף ראשון, כדי לא להטות מין בפנייה.
    you: 'אני',
    owner: 'מנהל',
    yourSpaces: 'המרחבים שלך',
    createOrJoin: 'יצירה או הצטרפות למרחב נוסף',
    leave: 'יציאה מהמרחב',
    confirmLeave: (name: string) => `לצאת מ"${name}"? הצמחים נשארים אצל שאר החברים.`,
    left: 'יצאת מהמרחב.',
    remove: 'מחיקת המרחב לכולם',
    confirmRemove: (name: string) =>
      `למחוק את "${name}" לכולם? כל הצמחים וההיסטוריה שבו יימחקו.`,
    removed: 'המרחב נמחק.',
    switchAria: 'המרחב הנוכחי',
  },

  spaceSetup: {
    titleCreate: 'מרחב חדש',
    titleJoin: 'הצטרפות למרחב',
    tabCreate: 'יצירה',
    tabJoin: 'הצטרפות',
    nameIt: 'איך לקרוא לו',
    namePlaceholder: 'הבית',
    nameHint: 'אחרי היצירה תקבל קוד להזמנת האחרים.',
    codeLabel: 'קוד הזמנה',
    codePlaceholder: 'ABC123',
    codeHint: 'מבקשים את הקוד בן שש התווים ממי שיצר את המרחב.',
    create: 'יצירת מרחב',
    join: 'הצטרפות',
    created: (name: string) => `"${name}" נוצר.`,
    joined: (name: string) => `הצטרפת ל"${name}".`,
    defaultName: 'הבית',
  },

  settings: {
    title: 'הגדרות',
    reminderTime: 'שעת התזכורת',
    reminderBody:
      'פעם ביום, בשעה שתבחר, PlantShare בודק את המרחבים שלך ושולח התראה אחת אם משהו צריך מים. בין לבין שום דבר לא רץ ברקע.',
    reminderAria: 'שעת התזכורת היומית',
    timezone: (tz: string) => `אזור הזמן שלך: ${tz}`,
    notifications: 'התראות במכשיר הזה',
    turnOn: 'הפעלת תזכורות',
    turnOff: 'כיבוי במכשיר הזה',
    sendTest: 'שליחת התראת בדיקה',
    enabled: 'התזכורות הופעלו במכשיר הזה.',
    disabled: 'התזכורות כובו במכשיר הזה.',
    blockedToast: 'הדפדפן חוסם התראות לאתר הזה. צריך לאשר אותן בהגדרות האתר ולחזור לכאן.',
    installHint:
      'ההתראות אמינות יותר כשהאפליקציה מותקנת: תפריט הדפדפן ← "הוספה למסך הבית".',
    account: 'חשבון',
    signOut: 'התנתקות',
    pushState: {
      subscribed: 'פעיל. המכשיר הזה יקבל את תזכורת הערב.',
      prompt: 'כבוי. אפשר להפעיל כדי לקבל כאן את תזכורת הערב.',
      denied:
        'חסום. הדפדפן מסרב לשלוח התראות לאתר הזה - צריך לאשר אותן בהגדרות האתר ואז לחזור.',
      unsupported: 'הדפדפן הזה לא תומך בהתראות. באנדרואיד כדאי Chrome, Edge או Firefox.',
      unconfigured: 'האפליקציה נבנתה בלי מפתח התראות, ולכן אי אפשר לשלוח אותן. ראה SETUP.md.',
    },
    language: 'שפה',
    languageBody:
      'משנה את הממשק ואת נוסח ההתראה שנשלחת אליך בערב. רק בשבילך — לכל אחד יש בחירה משלו.',
    test: {
      noServer: 'לא הצלחתי להגיע לשרת. האם הפונקציה send-test הועלתה?',
      noSubscription: 'המכשיר הזה עדיין לא רשום. צריך קודם להפעיל תזכורות.',
      rejected: 'שירות ההתראות דחה את הבקשה. כדאי לבדוק שהמפתחות תואמים.',
      sent: (delivered: number, total: number) =>
        `נשלחה ל-${delivered} מתוך ${total} ${total === 1 ? 'מכשיר' : 'מכשירים'}.`,
    },
  },

  errors: {
    noSuchCode: 'אין מרחב עם הקוד הזה. כדאי לבדוק את האותיות ולנסות שוב.',
    lastOwner:
      'המרחב הזה מנוהל רק על ידך ויש בו עוד חברים. אפשר למחוק אותו לכולם, אבל לא לצאת ולהשאיר אותו בלי מנהל.',
  },

  setup: {
    title: 'צריך להשלים הגדרה',
    lede: 'לבנייה הזאת אין עדיין כתובת Supabase ומפתח, ולכן אי אפשר להתחבר.',
    body: 'צריך למלא את שני הערכים בקובץ src/config.ts. כל השלבים מפורטים ב-SETUP.md.',
  },
}

/**
 * The shape every language has to provide. Derived from the Hebrew dictionary
 * rather than written out by hand, so adding a string to one language makes
 * the other fail to compile until it is translated.
 */
export type Strings = typeof he
