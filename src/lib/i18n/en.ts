// The English dictionary.
//
// Typed as `Strings`, which is derived from the Hebrew one, so a string added
// there fails to compile here until it is translated. That is deliberate: a
// half-translated interface is worse than an untranslated one, because you only
// find the gaps by stumbling into them.

import { days, plants as plantCount } from '../format'
import type { Strings } from './he'

export const en: Strings = {
  appName: 'PlantShare',

  nav: {
    tonight: 'Tonight',
    plants: 'Plants',
    space: 'Space',
    settings: 'Settings',
  },

  common: {
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    working: 'Working...',
    loading: 'Loading...',
    tryAgain: 'Try again',
    somethingWrong: 'Something went wrong',
    undo: 'Undo',
  },

  signIn: {
    tagline:
      'A shared watering list for the plants in your home. One person waters, everyone else sees it was done.',
    button: 'Continue with Google',
    opening: 'Opening Google...',
    privacy:
      'Your Google account is used only to sign you in and to show your name to the people you share a space with. Nothing else is stored or sent.',
  },

  onboarding: {
    title: 'Almost there',
    lede: 'Plants live in a shared space. Create one for your home, or join the one someone already made.',
  },

  tonight: {
    titleActive: 'Tonight',
    titleDone: 'All done',
    needWater: (n: number) => `${plantCount(n, 'en')} ${n === 1 ? 'needs' : 'need'} water`,
    allWatered: 'Everything due today has been watered.',
    nothingDue: 'Nothing is due today.',
    groupLate: 'Overdue',
    groupDue: 'Due today',
    groupDone: 'Watered this evening',
    nextUp: (what: string) => `Next up: ${what}`,
    nothingScheduled: 'nothing scheduled',
    emptyTitle: 'No plants yet',
    emptyBody: 'Add the first one and PlantShare will start reminding everyone in the space.',
    addPlant: 'Add a plant',
    watered: (name: string) => `${name} watered.`,
  },

  plant: {
    water: 'Water',
    waterAria: (name: string) => `Mark ${name} as watered`,
    badgeLate: (n: number) => `${days(n, 'en')} late`,
    badgeDue: 'tonight',
    badgeDone: 'done',
    wateredBy: (who: string) => `watered by ${who}`,
    wateredByYou: 'watered by you',
    nextIn: (when: string) => `next ${when}`,
    dueOn: (date: string) => `due: ${date}`,
    nextOn: (date: string) => `next: ${date}`,
    someoneElse: 'someone else',
  },

  plantForm: {
    titleNew: 'New plant',
    titleEdit: 'Edit plant',
    name: 'Name',
    namePlaceholder: 'Basil on the kitchen sill',
    waterEvery: 'Water every',
    presets: {
      daily: 'Daily',
      threeDays: '3 days',
      weekly: 'Weekly',
      twoWeeks: '2 weeks',
      monthly: 'Monthly',
    },
    daysUnit: 'days',
    daysAria: 'Days between watering',
    firstWatering: 'First watering',
    nextWatering: 'Next watering',
    notes: 'Notes (optional)',
    notesPlaceholder: 'Half a cup, no saucer',
    add: 'Add plant',
    delete: 'Delete this plant',
    confirmDelete: (name: string) =>
      `Delete ${name}? This removes it for everyone in the space.`,
    errorNoName: 'Give the plant a name.',
    errorPeriod: 'The watering period must be between 1 and 365 days.',
  },

  plants: {
    empty: 'No plants in this space yet.',
    emptyBody: 'Add a plant with its name and how often it needs water.',
    addFirst: 'Add the first plant',
    count: (n: number) => plantCount(n, 'en'),
    addAria: 'Add a plant',
    added: (name: string) => `${name} added.`,
    deleted: 'Plant deleted.',
  },

  space: {
    title: 'Space',
    subtitle: 'Everyone here shares the same watering list.',
    rename: 'Rename',
    nameAria: 'Space name',
    inviteTitle: 'Invite someone',
    inviteBody: 'They open the link, sign in with Google, and enter this code.',
    inviteCodeAria: 'Invite code',
    share: 'Share invite',
    copied: 'Invite copied.',
    codeIs: (code: string) => `Invite code: ${code}`,
    shareMessage: (name: string, url: string, code: string) =>
      `Join our plant watering list "${name}" on PlantShare.\n\nOpen ${url} and enter the code: ${code}`,
    shareTitle: 'PlantShare invite',
    members: (n: number) => `Members (${n})`,
    memberFallback: 'Member',
    you: 'you',
    owner: 'owner',
    yourSpaces: 'Your spaces',
    createOrJoin: 'Create or join another space',
    leave: 'Leave this space',
    confirmLeave: (name: string) =>
      `Leave "${name}"? Its plants stay with the other members.`,
    left: 'You left the space.',
    remove: 'Delete this space for everyone',
    confirmRemove: (name: string) =>
      `Delete "${name}" for everyone? All its plants and history are removed.`,
    removed: 'Space deleted.',
    switchAria: 'Current space',
  },

  spaceSetup: {
    titleCreate: 'New space',
    titleJoin: 'Join a space',
    tabCreate: 'Create',
    tabJoin: 'Join',
    nameIt: 'Name it',
    namePlaceholder: 'Home',
    nameHint: 'You will get a code to invite the others.',
    codeLabel: 'Invite code',
    codePlaceholder: 'ABC123',
    codeHint: 'Ask whoever set up the space for the six-character code.',
    create: 'Create space',
    join: 'Join',
    created: (name: string) => `"${name}" created.`,
    joined: (name: string) => `Joined "${name}".`,
    defaultName: 'Home',
  },

  settings: {
    title: 'Settings',
    reminderTime: 'Reminder time',
    reminderBody:
      'Once a day, at the time you pick, PlantShare checks your spaces and sends one notification if anything needs water. Nothing runs in between.',
    reminderAria: 'Daily reminder time',
    timezone: (tz: string) => `Your time zone: ${tz}`,
    notifications: 'Notifications on this device',
    turnOn: 'Turn on reminders',
    turnOff: 'Turn off on this device',
    sendTest: 'Send a test notification',
    enabled: 'Reminders on for this device.',
    disabled: 'Reminders off for this device.',
    blockedToast:
      'Notifications are blocked for this site. Allow them in your browser settings and come back.',
    installHint:
      'Reminders are more reliable once the app is installed: browser menu → "Add to Home screen".',
    account: 'Account',
    signOut: 'Sign out',
    pushState: {
      subscribed: 'On. This device will get the evening reminder.',
      prompt: 'Off. Turn them on to get the evening reminder here.',
      denied:
        'Blocked. Your browser is refusing notifications for this site - allow them in the site settings, then come back.',
      unsupported:
        'This browser cannot receive push notifications. On Android, use Chrome, Edge or Firefox.',
      unconfigured:
        'The app was built without a notification key, so reminders cannot be delivered. See SETUP.md.',
    },
    test: {
      noServer: 'Could not reach the server. Is the send-test function deployed?',
      noSubscription: 'This device is not subscribed yet. Turn reminders on first.',
      rejected: 'The push service rejected it. Check that the keys match.',
      sent: (delivered: number, total: number) =>
        `Sent to ${delivered} of ${total} device${total === 1 ? '' : 's'}.`,
    },
    language: 'Language',
    languageBody:
      'Changes the interface and the wording of your evening notification. Only for you - everyone else keeps their own.',
  },

  errors: {
    noSuchCode: 'No space with that code. Check the letters and try again.',
    lastOwner:
      'You are the only owner of this space and there are other members in it. You can delete it for everyone, but not leave it without an owner.',
  },

  setup: {
    title: 'PlantShare needs configuring',
    lede: 'This build has no Supabase URL or key yet, so it cannot sign anyone in.',
    body: 'Fill in the two values in src/config.ts. Every step is in SETUP.md.',
  },
}
