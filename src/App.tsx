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
import { GearIcon, LeafMark, ListIcon, PeopleIcon, TonightIcon } from './components/Icons'

type Tab = 'tonight' | 'plants' | 'space' | 'settings'

const TABS: { id: Tab; label: string; icon: (props: { size?: number }) => JSX.Element }[] = [
  { id: 'tonight', label: 'Tonight', icon: TonightIcon },
  { id: 'plants', label: 'Plants', icon: ListIcon },
  { id: 'space', label: 'Space', icon: PeopleIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon },
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
        <p className="muted">Loading...</p>
      </div>
    )
  }

  if (!session) return <SignIn />

  if (error) {
    return (
      <div className="centered-page">
        <h2>Something went wrong</h2>
        <p className="error-text">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  // A signed-in person with no space cannot do anything useful yet, so the
  // create-or-join sheet is the whole screen rather than a dismissable extra.
  if (spaces.length === 0) {
    return (
      <div className="centered-page">
        <LeafMark size={56} />
        <h1>Almost there</h1>
        <p className="lede">
          Plants live in a shared space. Create one for your home, or join the one
          someone already made.
        </p>
        <SpaceSetup onDone={() => setTab('plants')} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="app-title">
          <LeafMark size={26} />
          <span>PlantShare</span>
        </div>
        {spaces.length > 1 && (tab === 'plants' || tab === 'space') && (
          <select
            className="space-select"
            value={currentSpace?.id ?? ''}
            onChange={(event) => setCurrentSpaceId(event.target.value)}
            aria-label="Current space"
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

/** Shown when the build has no Supabase details - the first-deploy state. */
function SetupNeeded() {
  return (
    <div className="centered-page">
      <LeafMark size={56} />
      <h1>PlantShare needs configuring</h1>
      <p className="lede">
        This build has no Supabase URL or key, so it cannot sign anyone in.
      </p>
      <p className="muted">
        Add <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> and{' '}
        <code>VITE_VAPID_PUBLIC_KEY</code> as repository variables, then re-run the
        deploy. The steps are in <code>SETUP.md</code>.
      </p>
    </div>
  )
}
