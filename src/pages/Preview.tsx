import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CircleAlert, FileWarning, Info, MonitorPlay, RefreshCw, ShieldX, X } from 'lucide-react'
import { useDB } from '../store'
import { canManage, playerConnected, previewReadiness, previewResult, safeBack, startPreview, type PreviewResult, type PreviewStart } from '../content'
import { Badge, Btn, ClassTag, Empty, Page, Panel } from '../ui'

type Launch = { kind: 'idle' } | { kind: 'starting' } | PreviewStart

/** Staff preview of a SCORM module in the Student Portal's own player.
 *  Opening this page writes nothing to the library: visibility, progress and grades are untouched. */
export function Preview() {
  const { id = '' } = useParams()
  const [sp] = useSearchParams()
  const db = useDB()
  const nav = useNavigate()
  const back = safeBack(sp.get('back'))
  const [launch, setLaunch] = useState<Launch>(() => playerConnected() ? { kind: 'idle' } : { kind: 'unavailable' })
  const [result, setResult] = useState<PreviewResult | null | 'loading' | 'none'>(null)
  const m = db.materials.find(x => x.id === id)

  // Not found and not allowed look the same, so a direct link reveals nothing about other sections.
  if (!m || !canManage(db, m)) return (
    <Page title="Preview unavailable" back={back}>
      <Empty icon={ShieldX} title="You can't preview this material" text="It doesn't exist, or it belongs to a section you aren't assigned to." action={<Btn to={back}>Back to library</Btn>} />
    </Page>
  )

  const ready = previewReadiness(m)
  const close = () => nav(back)
  const go = async () => { setLaunch({ kind: 'starting' }); setResult(null); setLaunch(await startPreview(m.id)) }
  const refresh = async (attemptId: string) => { setResult('loading'); setResult(await previewResult(attemptId) ?? 'none') }

  return (
    <Page title={`Preview: ${m.title}`} sub={<span className="row wrap" style={{ gap: 8 }}><ClassTag id={m.classId} /><Badge tone={m.visible ? 'good' : 'neutral'}>{m.visible ? 'Visible to students' : 'Draft, hidden from students'}</Badge></span>} back={back}
      actions={<Btn icon={X} onClick={close}>Close preview</Btn>}>
      <p className="notice" role="note"><Info size={18} aria-hidden /><span>This is a staff preview. Nothing you do here counts toward student progress, attempts, grades, reports or completion. {m.visible ? 'Visibility stays as it is.' : 'The draft stays hidden from students.'}</span></p>

      {!ready.ok ? (
        <Panel title="Package can't launch">
          <p className="row" style={{ gap: 10, alignItems: 'flex-start' }}><FileWarning size={20} color="var(--bad)" aria-hidden /><span>{ready.reason}</span></p>
          {ready.recover === 'replace' && <div className="row wrap"><Btn kind="primary" to={`/library/upload?replace=${encodeURIComponent(m.id)}&back=${encodeURIComponent(back)}`}>Replace ZIP</Btn></div>}
        </Panel>
      ) : (
        <Panel title="Student player" action={<span className="small muted">{ready.version}, launches {ready.launch}</span>}>
          {launch.kind === 'started' ? <>
            <iframe className="player" src={launch.launchUrl} title={`${m.title}, student preview`} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="fullscreen; autoplay" />
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <span className="small muted" role="status">{result === 'loading' ? 'Checking the preview attempt…' : result === 'none' ? 'No result reported yet.' : result ? `Completion: ${result.completion}${result.success ? `, ${result.success}` : ''}${result.score != null ? `, score ${result.score}` : ''}. Preview attempt only.` : 'Work through the module, then check what it reported.'}</span>
              <Btn small icon={RefreshCw} onClick={() => void refresh(launch.attemptId)}>Check completion and score</Btn>
            </div>
          </> : launch.kind === 'starting' ? <p className="muted" role="status">Opening the Student Portal player…</p>
            : <div className="stack">
              {launch.kind === 'unavailable' && <p className="row" style={{ gap: 10, alignItems: 'flex-start' }} role="alert"><CircleAlert size={20} color="var(--warn)" aria-hidden /><span>The Student Portal SCORM player isn't connected to this copy of Teacher LMS, so the preview can't launch here. Nothing was recorded.</span></p>}
              {launch.kind === 'forbidden' && <p className="err" role="alert">The LMS says you aren't allowed to preview this material.</p>}
              {(launch.kind === 'not-ready' || launch.kind === 'error') && <p className="err" role="alert">{launch.reason}</p>}
              <div className="row wrap"><Btn kind="primary" icon={MonitorPlay} disabled={launch.kind === 'unavailable' || launch.kind === 'forbidden'} onClick={() => void go()}>{launch.kind === 'idle' ? 'Launch preview' : 'Try again'}</Btn></div>
            </div>}
        </Panel>
      )}
    </Page>
  )
}
