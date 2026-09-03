import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { initials } from '../lib/format'
import { useApp } from '../state/AppState'
import { useToast } from './Toast'
import { strings } from '../lib/strings'
import type { Member } from '../lib/types'

/** מי נמצא במרחב, איך מזמינים עוד מישהו, ואיך יוצאים ממנו. */
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
    const message = strings.space.shareMessage(
      currentSpace!.name,
      `${window.location.origin}${import.meta.env.BASE_URL}`,
      currentSpace!.invite_code,
    )
    // חלונית השיתוף של המערכת היא הדרך הטבעית בטלפון; הלוח הוא הגיבוי בכל
    // מקום אחר.
    if (navigator.share) {
      try {
        await navigator.share({ title: strings.space.shareTitle, text: message })
        return
      } catch {
        // סגרו את חלונית השיתוף; ממשיכים להעתקה.
      }
    }
    try {
      await navigator.clipboard.writeText(message)
      toast.show(strings.space.copied)
    } catch {
      toast.show(strings.space.codeIs(currentSpace!.invite_code))
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
    if (!window.confirm(strings.space.confirmLeave(currentSpace!.name))) return
    try {
      await api.leaveSpace(currentSpace!.id)
      await reload()
      toast.show(strings.space.left)
    } catch (cause) {
      toast.showError(cause)
    }
  }

  async function removeSpace() {
    if (!window.confirm(strings.space.confirmRemove(currentSpace!.name))) return
    try {
      await api.deleteSpace(currentSpace!.id)
      await reload()
      toast.show(strings.space.removed)
    } catch (cause) {
      toast.showError(cause)
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h2>{strings.space.title}</h2>
        <p className="screen-subtitle">{strings.space.subtitle}</p>
      </header>

      <section className="card">
        {renaming ? (
          <div className="inline-form">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={60}
              aria-label={strings.space.nameAria}
            />
            <button type="button" className="btn btn-primary btn-small" onClick={rename}>
              {strings.common.save}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setRenaming(false)}
            >
              {strings.common.cancel}
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
                {strings.space.rename}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h3>{strings.space.inviteTitle}</h3>
        <p className="muted">{strings.space.inviteBody}</p>
        <div className="invite-code" aria-label={strings.space.inviteCodeAria}>
          {currentSpace.invite_code}
        </div>
        <button type="button" className="btn btn-primary" onClick={share}>
          {strings.space.share}
        </button>
      </section>

      <section className="card">
        <h3>{strings.space.members(members.length)}</h3>
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
                {member.profile?.display_name || member.profile?.email || strings.space.memberFallback}
                {member.user_id === session?.user.id && (
                  <span className="chip">{strings.space.you}</span>
                )}
              </span>
              {member.role === 'owner' && <span className="chip">{strings.space.owner}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>{strings.space.yourSpaces}</h3>
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
          {strings.space.createOrJoin}
        </button>
      </section>

      <section className="card card-quiet">
        <button type="button" className="btn btn-danger-text" onClick={leave}>
          {strings.space.leave}
        </button>
        {isOwner && (
          <button type="button" className="btn btn-danger-text" onClick={removeSpace}>
            {strings.space.remove}
          </button>
        )}
      </section>

      {showJoin && <SpaceSetup onDone={() => setShowJoin(false)} allowCancel />}
    </div>
  )
}

/**
 * יצירה או הצטרפות. משמש גם למרחב הראשון - שם אין לאן לבטל - וגם אחר כך
 * מלשונית המרחב.
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
        mode === 'create'
          ? await api.createSpace(name.trim() || strings.spaceSetup.defaultName)
          : await api.joinSpace(code)
      setCurrentSpaceId(space.id)
      await reload()
      toast.show(
        mode === 'create'
          ? strings.spaceSetup.created(space.name)
          : strings.spaceSetup.joined(space.name),
      )
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={allowCancel ? onDone : undefined} role="presentation">
      <form className="sheet" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>
          {mode === 'create' ? strings.spaceSetup.titleCreate : strings.spaceSetup.titleJoin}
        </h2>

        <div className="segmented">
          <button
            type="button"
            className={mode === 'create' ? 'segment segment-active' : 'segment'}
            onClick={() => setMode('create')}
          >
            {strings.spaceSetup.tabCreate}
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'segment segment-active' : 'segment'}
            onClick={() => setMode('join')}
          >
            {strings.spaceSetup.tabJoin}
          </button>
        </div>

        {mode === 'create' ? (
          <label className="field">
            <span>{strings.spaceSetup.nameIt}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={strings.spaceSetup.namePlaceholder}
              maxLength={60}
              autoComplete="off"
            />
            <small>{strings.spaceSetup.nameHint}</small>
          </label>
        ) : (
          <label className="field">
            <span>{strings.spaceSetup.codeLabel}</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={strings.spaceSetup.codePlaceholder}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              className="code-input"
            />
            <small>{strings.spaceSetup.codeHint}</small>
          </label>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="sheet-actions">
          {allowCancel && (
            <button type="button" className="btn btn-ghost" onClick={onDone}>
              {strings.common.cancel}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? strings.common.working
              : mode === 'create'
                ? strings.spaceSetup.create
                : strings.spaceSetup.join}
          </button>
        </div>
      </form>
    </div>
  )
}
