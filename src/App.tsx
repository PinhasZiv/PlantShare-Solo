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
import { strings } from './lib/strings'
import { GearIcon, LeafMark, ListIcon, PeopleIcon, TonightIcon } from './components/Icons'

type Tab = 'tonight' | 'plants' | 'space' | 'settings'

const TABS: { id: Tab; label: string; icon: (props: { size?: number }) => JSX.Element }[] = [
  { id: 'tonight', label: strings.nav.tonight, icon: TonightIcon },
  { id: 'plants', label: strings.nav.plants, icon: ListIcon },
  { id: 'space', label: strings.nav.space, icon: PeopleIcon },
  { id: 'settings', label: strings.nav.settings, icon: GearIcon },
]

export default function App() {
  useEffect(() => {
    void registerServiceWorker()
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
  const [tab, setTab] = useState<Tab>('tonight')

  if (loading) {
    return (
      <div className="centered-page">
        <LeafMark size={48} />
        <p className="muted">{strings.common.loading}</p>
      </div>
    )
  }

  if (!session) return <SignIn />

  if (error) {
    return (
      <div className="centered-page">
        <h2>{strings.common.somethingWrong}</h2>
        <p className="error-text">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {strings.common.tryAgain}
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
        <h1>{strings.onboarding.title}</h1>
        <p className="lede">{strings.onboarding.lede}</p>
        <SpaceSetup onDone={() => setTab('plants')} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="app-title">
          <LeafMark size={26} />
          <span>{strings.appName}</span>
        </div>
        {spaces.length > 1 && (tab === 'plants' || tab === 'space') && (
          <select
            className="space-select"
            value={currentSpace?.id ?? ''}
            onChange={(event) => setCurrentSpaceId(event.target.value)}
            aria-label={strings.space.switchAria}
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
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

/** מוצג כשלבנייה אין פרטי Supabase - המצב של פריסה ראשונה. */
function SetupNeeded() {
  return (
    <div className="centered-page">
      <LeafMark size={56} />
      <h1>{strings.setup.title}</h1>
      <p className="lede">{strings.setup.lede}</p>
      <p className="muted">{strings.setup.body}</p>
    </div>
  )
}
