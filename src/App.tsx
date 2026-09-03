import { useEffect, useState } from 'react'
import { isConfigured } from './lib/supabase'
import { registerServiceWorker } from './lib/push'
import { AppProvider, useApp } from './state/AppState'
import { ToastProvider } from './components/Toast'
import { SignIn } from './components/SignIn'
import { TonightScreen } from './components/TonightScreen'
import { PlantsScreen } from './components/PlantsScreen'
import { SpaceScreen, SpaceSetup } from './components/SpaceScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { applyLanguageToDocument, useI18n } from './lib/i18n'
import { GearIcon, LeafMark, ListIcon, PeopleIcon, TonightIcon } from './components/Icons'

type Tab = 'tonight' | 'plants' | 'space' | 'settings'

// The icons are fixed, the labels are not, so only the labels are looked up
// per render.
const TAB_ICONS: Record<Tab, (props: { size?: number }) => JSX.Element> = {
  tonight: TonightIcon,
  plants: ListIcon,
  space: PeopleIcon,
  settings: GearIcon,
}

const TAB_ORDER: Tab[] = ['tonight', 'plants', 'space', 'settings']

export default function App() {
  useEffect(() => {
    void registerServiceWorker()
    // The <html> element carries the language chosen on this device, which the
    // inline script in index.html has already applied; this keeps it correct
    // after a hot reload or a language change made in another tab.
    applyLanguageToDocument()
  }, [])

  if (!isConfigured) return <SetupNeeded />

  return (
    <AppProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AppProvider>
  )
}

function Shell() {
  const { session, loading, error, spaces, currentSpace, setCurrentSpaceId } = useApp()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('tonight')

  if (loading) {
    return (
      <div className="centered-page">
        <LeafMark size={48} />
        <p className="muted">{t.common.loading}</p>
      </div>
    )
  }

  if (!session) return <SignIn />

  if (error) {
    return (
      <div className="centered-page">
        <h2>{t.common.somethingWrong}</h2>
        <p className="error-text">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t.common.tryAgain}
        </button>
      </div>
    )
  }

  // מי שנכנס ואין לו מרחב לא יכול לעשות שום דבר מועיל, ולכן חלונית היצירה
  // או ההצטרפות היא כל המסך ולא תוספת שאפשר לסגור.
  if (spaces.length === 0) {
    return (
      <div className="centered-page">
        <LeafMark size={56} />
        <h1>{t.onboarding.title}</h1>
        <p className="lede">{t.onboarding.lede}</p>
        <SpaceSetup onDone={() => setTab('plants')} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="app-title">
          <LeafMark size={26} />
          <span>{t.appName}</span>
        </div>
        {spaces.length > 1 && (tab === 'plants' || tab === 'space') && (
          <select
            className="space-select"
            value={currentSpace?.id ?? ''}
            onChange={(event) => setCurrentSpaceId(event.target.value)}
            aria-label={t.space.switchAria}
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        )}
      </header>

      <main className="app-body">
        {tab === 'tonight' && <TonightScreen onManagePlants={() => setTab('plants')} />}
        {tab === 'plants' && <PlantsScreen />}
        {tab === 'space' && <SpaceScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      <nav className="tab-bar">
        {TAB_ORDER.map((id) => {
          const Icon = TAB_ICONS[id]
          return (
            <button
              key={id}
              type="button"
              className={tab === id ? 'tab tab-active' : 'tab'}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon size={22} />
              <span>{t.nav[id]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/** מוצג כשלבנייה אין פרטי Supabase - המצב של פריסה ראשונה. */
function SetupNeeded() {
  const { t } = useI18n()
  return (
    <div className="centered-page">
      <LeafMark size={56} />
      <h1>{t.setup.title}</h1>
      <p className="lede">{t.setup.lede}</p>
      <p className="muted">{t.setup.body}</p>
    </div>
  )
}
