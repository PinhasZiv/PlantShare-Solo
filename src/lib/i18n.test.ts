import { describe, expect, it } from 'vitest'
import { en } from './i18n/en'
import { he } from './i18n/he'
import { directionOf, isLanguage, LANGUAGES } from './i18n/types'
import { days, describePeriod, formatDate, plants, relativeDay } from './format'
import { composeReminder } from '../../supabase/functions/_shared/messages.ts'

// The type system already forces the two dictionaries to have the same shape.
// These tests cover what it cannot: that no entry was left in the wrong
// language, and that the number and date wording is right in both.

describe('the dictionaries', () => {
  const entries = (value: unknown, path = ''): [string, string][] => {
    if (typeof value === 'string') return [[path, value]]
    if (typeof value === 'function') return []
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, child]) =>
        entries(child, path ? `${path}.${key}` : key),
      )
    }
    return []
  }

  const hebrew = /[֐-׿]/

  it('has no untranslated Hebrew left in the English dictionary', () => {
    const leftovers = entries(en).filter(([, text]) => hebrew.test(text))
    // The language picker names each language in its own script, so that one
    // Hebrew string in the English dictionary is correct.
    expect(leftovers.map(([path]) => path)).toEqual([])
  })

  it('has Hebrew text in the Hebrew dictionary', () => {
    const translated = entries(he).filter(([, text]) => hebrew.test(text))
    expect(translated.length).toBeGreaterThan(40)
  })

  it('covers the same keys in both, including the nested ones', () => {
    expect(entries(en).map(([path]) => path).sort()).toEqual(
      entries(he).map(([path]) => path).sort(),
    )
  })
})

describe('language metadata', () => {
  it('maps each language to its writing direction', () => {
    expect(directionOf('he')).toBe('rtl')
    expect(directionOf('en')).toBe('ltr')
  })

  it('rejects anything that is not a supported language', () => {
    expect(LANGUAGES.every(isLanguage)).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(null)).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})

describe('counting in Hebrew', () => {
  // The dual form is the thing a naive translation gets wrong.
  it('uses the dual form for two', () => {
    expect(days(2, 'he')).toBe('יומיים')
    expect(days(1, 'he')).toBe('יום')
    expect(days(3, 'he')).toBe('3 ימים')
  })

  it('inflects plants by number', () => {
    expect(plants(1, 'he')).toBe('צמח אחד')
    expect(plants(4, 'he')).toBe('4 צמחים')
  })

  it('has a day after tomorrow', () => {
    expect(relativeDay('2026-05-12', '2026-05-10', 'he')).toBe('מחרתיים')
  })
})

describe('counting in English', () => {
  it('pluralises normally', () => {
    expect(days(1, 'en')).toBe('1 day')
    expect(days(2, 'en')).toBe('2 days')
    expect(plants(1, 'en')).toBe('1 plant')
    expect(plants(2, 'en')).toBe('2 plants')
  })

  it('words relative days the English way', () => {
    expect(relativeDay('2026-05-10', '2026-05-10', 'en')).toBe('today')
    expect(relativeDay('2026-05-11', '2026-05-10', 'en')).toBe('tomorrow')
    expect(relativeDay('2026-05-13', '2026-05-10', 'en')).toBe('in 3 days')
    expect(relativeDay('2026-05-07', '2026-05-10', 'en')).toBe('3 days ago')
  })
})

describe('periods and dates', () => {
  it('names the common periods idiomatically in each language', () => {
    expect(describePeriod(7, 'he')).toBe('פעם בשבוע')
    expect(describePeriod(7, 'en')).toBe('weekly')
    expect(describePeriod(2, 'he')).toBe('כל יומיים')
    expect(describePeriod(9, 'en')).toBe('every 9 days')
  })

  it('formats a date in each language, from the same stored string', () => {
    // Same day, two renderings - and neither may shift the date, which is what
    // a naive `new Date(iso)` would do west of Greenwich.
    expect(formatDate('2026-09-03', 'en')).toContain('Sep')
    expect(formatDate('2026-09-03', 'en')).toContain('3')
    expect(formatDate('2026-09-03', 'he')).toContain('3')
    expect(formatDate('2026-09-03', 'he')).toMatch(/[֐-׿]/)
  })
})

describe('the dictionaries produce sentences, not fragments', () => {
  it('builds the tonight summary in both languages', () => {
    expect(he.tonight.needWater(1)).toBe('צמח אחד ממתין להשקיה')
    expect(he.tonight.needWater(3)).toBe('3 צמחים ממתינים להשקיה')
    expect(en.tonight.needWater(1)).toBe('1 plant needs water')
    expect(en.tonight.needWater(3)).toBe('3 plants need water')
  })

  it('builds the late badge in both languages', () => {
    expect(he.plant.badgeLate(2)).toBe('איחור של יומיים')
    expect(en.plant.badgeLate(2)).toBe('2 days late')
  })
})

describe('the evening notification', () => {
  // Composed on the server, hours after the app was last open, which is why
  // the language has to be stored rather than read from a browser.
  it('names the plants and how late they are, in Hebrew', () => {
    const { title, body } = composeReminder(
      [
        { name: 'בזיליקום', daysLate: 2 },
        { name: 'מונסטרה', daysLate: 0 },
      ],
      'he',
    )
    expect(title).toBe('איחור של יומיים · 2 צמחים')
    expect(body).toBe('בזיליקום (יומיים איחור), מונסטרה')
  })

  it('says the same thing in English', () => {
    const { title, body } = composeReminder(
      [
        { name: 'Basil', daysLate: 2 },
        { name: 'Monstera', daysLate: 0 },
      ],
      'en',
    )
    expect(title).toBe('2 days late · 2 plants')
    expect(body).toBe('Basil (2 days late), Monstera')
  })

  it('drops the lateness clause when nothing is overdue', () => {
    expect(composeReminder([{ name: 'Aloe', daysLate: 0 }], 'en')).toEqual({
      title: 'Time to water · 1 plant',
      body: 'Aloe',
    })
    expect(composeReminder([{ name: 'אלוורה', daysLate: 0 }], 'he').title).toBe(
      'הגיע הזמן להשקות · צמח אחד',
    )
  })

  it('prefixes the space name only when the person is in more than one', () => {
    const { body } = composeReminder(
      [{ name: 'Basil', spaceName: 'Office', daysLate: 1 }],
      'en',
    )
    expect(body).toBe('Office: Basil (1 day late)')
  })

  it('truncates a long list rather than filling the notification tray', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ name: `Plant ${i}`, daysLate: 0 }))
    expect(composeReminder(many, 'en').body).toBe(
      'Plant 0, Plant 1, Plant 2, Plant 3 +3 more',
    )
    expect(composeReminder(many, 'he').body).toContain('ועוד 3')
  })
})
