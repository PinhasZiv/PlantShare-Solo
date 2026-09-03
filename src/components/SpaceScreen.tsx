import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { initials } from '../lib/format'
import { useApp } from '../state/AppState'
import { useToast } from './Toast'
import type { Member } from '../lib/types'

/** Who is in this space, how to invite someone, and how to get out. */
export function SpaceScreen() {
  const { currentSpace, spaces, session, reload, setCurrentSpaceId } = useApp()
  const toast = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [showJoin, setShowJoin] = useState(false)

  useEffect(() => {
    if (!currentSpace) return
    let cancelled = false
    api
      .fetchMembers(currentSpace.id)
      .then((rows) => {
        if (!cancelled) setMembers(rows)
      })
      .catch((cause) => toast.showError(cause))
    return () => {
      cancelled = true
    }
  }, [currentSpace, toast])

  if (!currentSpace) return null

  const isOwner = members.some(
    (member) => member.user_id === session?.user.id && member.role === 'owner',
  )

  async function share() {
    const message = `Join our plant watering list "${currentSpace!.name}" on PlantShare.\n\nOpen ${window.location.origin}${import.meta.env.BASE_URL} and enter the code: ${currentSpace!.invite_code}`
    // The Web Share sheet is the natural route on a phone; the clipboard is the
    // fallback everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PlantShare invite', text: message })
        return
      } catch {
        // Dismissed the share sheet; fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(message)
      toast.show('Invite copied.')
    } catch {
      toast.show(`Invite code: ${currentSpace!.invite_code}`)
    }
  }

  async function rename() {
    try {
      await api.renameSpace(currentSpace!.id, draftName.trim())
      setRenaming(false)
      await reload()
    } catch (cause) {
      toast.showError(cause)
    }
  }

  async function leave() {
    if (!window.confirm(`Leave "${currentSpace!.name}"? Its plants stay with the other members.`)) return
    try {
      await api.leaveSpace(currentSpace!.id)
      await reload()
      toast.show('You left the space.')
    } catch (cause) {
      toast.showError(cause)
    }
  }

  async function removeSpace() {
    if (
      !window.confirm(
        `Delete "${currentSpace!.name}" for everyone? All its plants and history are removed.`,
      )
    )
      return
    try {
      await api.deleteSpace(currentSpace!.id)
      await reload()
      toast.show('Space deleted.')
    } catch (cause) {
      toast.showError(cause)
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h2>Space</h2>
        <p className="screen-subtitle">Everyone here shares the same watering list.</p>
      </header>

      <section className="card">
        {renaming ? (
          <div className="inline-form">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={60}
              aria-label="Space name"
            />
            <button type="button" className="btn btn-primary btn-small" onClick={rename}>
              Save
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="row-between">
            <h3>{currentSpace.name}</h3>
            {isOwner && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => {
                  setDraftName(currentSpace.name)
                  setRenaming(true)
                }}
              >
                Rename
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Invite someone</h3>
        <p className="muted">
          They open the app, sign in with Google, and enter this code.
        </p>
        <div className="invite-code" aria-label="Invite code">
          {currentSpace.invite_code}
        </div>
        <button type="button" className="btn btn-primary" onClick={share}>
          Share invite
        </button>
      </section>

      <section className="card">
        <h3>Members ({members.length})</h3>
        <ul className="member-list">
          {members.map((member) => (
            <li key={member.user_id}>
              {member.profile?.avatar_url ? (
                <img src={member.profile.avatar_url} alt="" className="avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="avatar avatar-initials">
                  {initials(member.profile?.display_name ?? null, member.profile?.email ?? null)}
                </span>
              )}
              <span className="member-name">
                {member.profile?.display_name || member.profile?.email || 'Member'}
                {member.user_id === session?.user.id && <span className="chip">you</span>}
              </span>
              {member.role === 'owner' && <span className="chip">owner</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Your spaces</h3>
        <ul className="space-list">
          {spaces.map((space) => (
            <li key={space.id}>
              <button
                type="button"
                className={`space-row ${space.id === currentSpace.id ? 'space-row-active' : ''}`}
                onClick={() => setCurrentSpaceId(space.id)}
              >
                {space.name}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(true)}>
          Create or join another space
        </button>
      </section>

      <section className="card card-quiet">
        <button type="button" className="btn btn-danger-text" onClick={leave}>
          Leave this space
        </button>
        {isOwner && (
          <button type="button" className="btn btn-danger-text" onClick={removeSpace}>
            Delete this space for everyone
          </button>
        )}
      </section>

      {showJoin && <SpaceSetup onDone={() => setShowJoin(false)} allowCancel />}
    </div>
  )
}

/**
 * Create-or-join, used both for the very first space (where there is nothing to
 * cancel back to) and later from the Space tab.
 */
export function SpaceSetup({
  onDone,
  allowCancel = false,
}: {
  onDone: () => void
  allowCancel?: boolean
}) {
  const { reload, setCurrentSpaceId } = useApp()
  const toast = useToast()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const space =
        mode === 'create' ? await api.createSpace(name.trim() || 'Home') : await api.joinSpace(code)
      setCurrentSpaceId(space.id)
      await reload()
      toast.show(mode === 'create' ? `"${space.name}" created.` : `Joined "${space.name}".`)
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={allowCancel ? onDone : undefined} role="presentation">
      <form className="sheet" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>{mode === 'create' ? 'New space' : 'Join a space'}</h2>

        <div className="segmented">
          <button
            type="button"
            className={mode === 'create' ? 'segment segment-active' : 'segment'}
            onClick={() => setMode('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'segment segment-active' : 'segment'}
            onClick={() => setMode('join')}
          >
            Join
          </button>
        </div>

        {mode === 'create' ? (
          <label className="field">
            <span>Name it</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Home"
              maxLength={60}
              autoComplete="off"
            />
            <small>You will get a code to invite the others.</small>
          </label>
        ) : (
          <label className="field">
            <span>Invite code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              className="code-input"
            />
            <small>Ask whoever set up the space for the six-character code.</small>
          </label>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="sheet-actions">
          {allowCancel && (
            <button type="button" className="btn btn-ghost" onClick={onDone}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Working...' : mode === 'create' ? 'Create space' : 'Join'}
          </button>
        </div>
      </form>
    </div>
  )
}
