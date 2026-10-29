import { startTransition, useEffect, useEffectEvent, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FolderPlus,
  LayoutDashboard,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import './App.css'

const currency = new Intl.NumberFormat('en-TZ', {
  style: 'currency',
  currency: 'TZS',
  maximumFractionDigits: 2,
})
const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
const money = (amount) => currency.format(Number(amount || 0))
const today = () => new Date().toISOString().slice(0, 10)

async function api(path, options = {}) {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  const response = await fetch(`${base}/api${path}`, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...options,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || 'Something went wrong.')
  return result
}

function App() {
  const [summary, setSummary] = useState(null)
  const [needs, setNeeds] = useState([])
  const [categories, setCategories] = useState([])
  const [funds, setFunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('overview')
  const [statusFilter, setStatusFilter] = useState('open')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  async function refreshData() {
    try {
      const [dashboard, needRows, categoryRows, fundRows] = await Promise.all([
        api('/dashboard'),
        api('/needs'),
        api('/categories'),
        api('/funds'),
      ])
      setSummary(dashboard.summary)
      setNeeds(needRows)
      setCategories(categoryRows)
      setFunds(fundRows)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const loadData = useEffectEvent(refreshData)

  useEffect(() => {
    startTransition(() => loadData())
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const visibleNeeds = needs.filter((need) => {
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'open' && need.status !== 'fulfilled')
      || need.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || String(need.category_id) === categoryFilter
    const matchesQuery = `${need.title} ${need.description || ''} ${need.category?.name || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
    return matchesStatus && matchesCategory && matchesQuery
  })
  const listNeeds = view === 'overview' ? visibleNeeds.slice(0, 5) : visibleNeeds
  const latestFund = funds[0]

  async function submitNeed(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const recurring = form.get('is_recurring') === 'on'
    const data = {
      title: form.get('title'),
      description: form.get('description') || null,
      amount_needed: Number(form.get('amount_needed')),
      priority: form.get('priority'),
      deadline: form.get('deadline') || null,
      category_id: form.get('category_id') ? Number(form.get('category_id')) : null,
      is_recurring: recurring,
      recurrence_interval: recurring ? form.get('recurrence_interval') : null,
    }
    if (modal.need?.id) data.status = modal.need.status
    await saveAction(async () => {
      await api(modal.need?.id ? `/needs/${modal.need.id}` : '/needs', {
        method: modal.need?.id ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      })
      setModal(null)
      setNotice(modal.need?.id ? 'Need updated' : 'Need added to your plan')
    })
  }

  async function submitContribution(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await saveAction(async () => {
      await api(`/needs/${modal.need.id}/contributions`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(form.get('amount')), contributed_on: form.get('contributed_on') }),
      })
      setModal(null)
      setNotice('Contribution recorded')
    })
  }

  async function submitFund(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await saveAction(async () => {
      await api('/funds', {
        method: 'POST',
        body: JSON.stringify({
          period_start: form.get('period_start'),
          period_end: form.get('period_end'),
          amount_available: Number(form.get('amount_available')),
          notes: form.get('notes') || null,
        }),
      })
      setModal(null)
      setNotice('Funds added for this period')
    })
  }

  async function submitCategory(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await saveAction(async () => {
      await api('/categories', { method: 'POST', body: JSON.stringify({ name: form.get('name') }) })
      setModal(null)
      setNotice('Category created')
    })
  }

  async function saveAction(action) {
    setSaving(true)
    try {
      await action()
      await refreshData()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(need, status) {
    await saveAction(async () => {
      await api(`/needs/${need.id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      setNotice(status === 'fulfilled' ? 'Need marked fulfilled' : 'Need reopened')
    })
  }

  async function deleteNeed(need) {
    if (!window.confirm(`Delete “${need.title}” and its contributions?`)) return
    await saveAction(async () => {
      await api(`/needs/${need.id}`, { method: 'DELETE' })
      setNotice('Need deleted')
    })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setView('overview')}>
          <span className="brand-mark"><Target size={20} strokeWidth={2.3} /></span>
          <span>good<span className="brand-light">measure</span></span>
        </a>
        <p className="side-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={view === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setView('overview')}>
            <LayoutDashboard size={18} /> Overview
          </button>
          <button className={view === 'needs' ? 'nav-item active' : 'nav-item'} onClick={() => setView('needs')}>
            <CheckCircle2 size={18} /> My needs <span className="nav-count">{needs.filter((need) => need.status !== 'fulfilled').length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note-icon"><CircleDollarSign size={18} /></div>
          <p className="side-note-title">Small steps add up.</p>
          <p className="side-note-copy">Keep your priorities close and your plan flexible.</p>
        </div>
        <div className="profile-row">
          <div className="profile-avatar">B</div>
          <div><strong>My budget</strong><span>Personal workspace</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Budget <span>/</span> {view === 'overview' ? 'Overview' : 'My needs'}</div>
          <div className="topbar-right">
            <span className="today-label"><CalendarDays size={15} /> {dateLabel}</span>
            <button className="icon-button" title="Add a category" aria-label="Add a category" onClick={() => setModal({ type: 'category' })}>
              <FolderPlus size={18} />
            </button>
          </div>
        </header>

        <div className="page-wrap">
          {error && (
            <div className="connection-alert" role="alert">
              <span><strong>Can’t reach your budget data.</strong> {error}</span>
              <button onClick={refreshData}>Retry</button>
            </div>
          )}

          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR MONEY, WITH INTENTION</p>
              <h1>{view === 'overview' ? 'Plan what matters.' : 'Your needs, in focus.'}</h1>
              <p className="welcome-copy">A clearer view of what you have, what you’re saving for, and what comes next.</p>
            </div>
            <button className="primary-button" onClick={() => setModal({ type: 'need' })}><Plus size={17} /> Add a need</button>
          </section>

          <section className="stat-grid" aria-label="Budget summary">
            <StatCard icon={<Wallet size={18} />} label="Funds logged" value={money(summary?.funds_total)} note="Across all periods" accent="mint" />
            <StatCard icon={<ArrowUpRight size={19} />} label="Saved so far" value={money(summary?.saved_total)} note="Contributions toward needs" accent="blue" />
            <StatCard icon={<ArrowDownRight size={19} />} label="Still to save" value={money(summary?.remaining_total)} note="Across your active plan" accent="peach" />
            <StatCard icon={<CheckCircle2 size={18} />} label="Needs in progress" value={summary?.active_needs ?? '—'} note={`${summary?.fulfilled_needs ?? 0} fulfilled`} accent="yellow" />
          </section>

          <div className="content-grid">
            <section className="needs-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">THE PLAN</p>
                  <h2>{view === 'overview' ? 'Needs to keep in sight' : 'All your needs'}</h2>
                </div>
                {view === 'overview' && <button className="text-button" onClick={() => setView('needs')}>See all <span aria-hidden="true">→</span></button>}
              </div>

              <div className="list-tools">
                <div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a need" aria-label="Search needs" /></div>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                  <option value="all">All categories</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="filter-tabs" role="tablist" aria-label="Filter needs by status">
                {[['open', 'Open'], ['funded', 'Funded'], ['fulfilled', 'Fulfilled'], ['all', 'Everything']].map(([value, label]) => (
                  <button key={value} className={statusFilter === value ? 'filter-tab selected' : 'filter-tab'} onClick={() => setStatusFilter(value)} role="tab" aria-selected={statusFilter === value}>{label}</button>
                ))}
              </div>

              <div className="need-list">
                {loading && <div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading your plan…</div>}
                {!loading && listNeeds.map((need) => (
                  <NeedRow
                    key={need.id}
                    need={need}
                    onEdit={() => setModal({ type: 'need', need })}
                    onContribute={() => setModal({ type: 'contribution', need })}
                    onDelete={() => deleteNeed(need)}
                    onStatus={() => updateStatus(need, need.status === 'fulfilled' ? 'pending' : 'fulfilled')}
                  />
                ))}
                {!loading && listNeeds.length === 0 && <div className="empty-state"><span className="empty-icon"><Target size={22} /></span><h3>{error ? 'Your plan is ready to load' : 'A plan starts with one thing.'}</h3><p>{error ? 'Connect the API to see your needs here.' : 'Add a need to begin tracking what matters to you.'}</p>{!error && <button className="text-button" onClick={() => setModal({ type: 'need' })}>Add your first need <span aria-hidden="true">→</span></button>}</div>}
              </div>
            </section>

            <aside className="right-column">
              <section className="fund-panel">
                <div className="panel-title-row"><div><p className="eyebrow">YOUR RESOURCES</p><h2>Available funds</h2></div><span className="fund-icon"><Wallet size={18} /></span></div>
                <p className="fund-amount">{money(latestFund?.amount_available)}</p>
                {latestFund ? <p className="fund-period">{formatDate(latestFund.period_start)} – {formatDate(latestFund.period_end)}</p> : <p className="fund-period">No period recorded yet</p>}
                {latestFund?.notes && <p className="fund-note">{latestFund.notes}</p>}
                <button className="secondary-button" onClick={() => setModal({ type: 'fund' })}><Plus size={16} /> Log a fund period</button>
              </section>

              <section className="focus-panel">
                <div className="section-heading compact"><div><p className="eyebrow">NEXT UP</p><h2>Priority needs</h2></div><Clock3 size={18} className="muted-icon" /></div>
                {needs.filter((need) => need.status !== 'fulfilled').slice(0, 3).map((need, index) => (
                  <button className="priority-item" key={need.id} onClick={() => setModal({ type: 'need', need })}>
                    <span className={`priority-number priority-${need.priority}`}>0{index + 1}</span>
                    <span className="priority-copy"><strong>{need.title}</strong><small>{need.category?.name || 'Uncategorized'} · {money(need.amount_needed)}</small></span>
                    <span className="priority-dot" />
                  </button>
                ))}
                {needs.filter((need) => need.status !== 'fulfilled').length === 0 && <p className="quiet-empty">Your next priority will show up here.</p>}
              </section>

              <div className="tip-strip"><span><Check size={14} /></span><p>Progress is progress, even when it comes in small amounts.</p></div>
            </aside>
          </div>
          <footer className="page-footer"><span>GOODMEASURE</span><span>Make room for what matters.</span></footer>
        </div>
      </main>

      {notice && <div className="toast" role="status"><CheckCircle2 size={17} /> {notice}</div>}
      {modal && <Modal title={modalTitle(modal)} onClose={() => setModal(null)}>
        {modal.type === 'need' && <NeedForm need={modal.need} categories={categories} saving={saving} onSubmit={submitNeed} onAddCategory={() => setModal({ type: 'category' })} onCancel={() => setModal(null)} />}
        {modal.type === 'contribution' && <ContributionForm need={modal.need} saving={saving} onSubmit={submitContribution} onCancel={() => setModal(null)} />}
        {modal.type === 'fund' && <FundForm saving={saving} onSubmit={submitFund} onCancel={() => setModal(null)} />}
        {modal.type === 'category' && <CategoryForm saving={saving} onSubmit={submitCategory} onCancel={() => setModal(null)} />}
      </Modal>}
    </div>
  )
}

function StatCard({ icon, label, value, note, accent }) {
  return <article className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><p className="stat-label">{label}</p><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></article>
}

function NeedRow({ need, onEdit, onContribute, onDelete, onStatus }) {
  const saved = Number(need.amount_saved || 0)
  const target = Number(need.amount_needed || 0)
  const progress = target ? Math.min(100, Math.round((saved / target) * 100)) : 0
  return (
    <article className="need-row">
      <div className="need-main">
        <div className="need-title-line"><h3>{need.title}</h3><span className={`status-badge status-${need.status}`}>{need.status}</span></div>
        <p className="need-description">{need.description || need.category?.name || 'No description'}</p>
        <div className="need-progress-line"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span className="progress-label">{progress}%</span></div>
        <div className="need-meta"><span>{need.category?.name || 'Uncategorized'}</span><span className={`priority-label ${need.priority}`}>{need.priority} priority</span>{need.deadline && <span><CalendarDays size={13} /> {formatDate(need.deadline)}</span>}</div>
      </div>
      <div className="need-amount"><strong>{money(saved)}</strong><span>of {money(target)}</span></div>
      <div className="need-actions">
        {need.status !== 'fulfilled' && <button className="contribute-button" onClick={onContribute}>Add money</button>}
        <button className="small-icon-button" title="Edit need" aria-label={`Edit ${need.title}`} onClick={onEdit}><Pencil size={15} /></button>
        <button className="small-icon-button" title={need.status === 'fulfilled' ? 'Reopen need' : 'Mark fulfilled'} aria-label={need.status === 'fulfilled' ? `Reopen ${need.title}` : `Mark ${need.title} fulfilled`} onClick={onStatus}>{need.status === 'fulfilled' ? <ArrowUpRight size={16} /> : <Check size={16} />}</button>
        <button className="small-icon-button danger-hover" title="Delete need" aria-label={`Delete ${need.title}`} onClick={onDelete}><Trash2 size={15} /></button>
      </div>
    </article>
  )
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>{children}</section></div>
}

function NeedForm({ need, categories, saving, onSubmit, onAddCategory, onCancel }) {
  return <form className="form-body" onSubmit={onSubmit}>
    <label>Need title<input name="title" defaultValue={need?.title} maxLength="150" required placeholder="e.g. Replace my laptop" /></label>
    <label>Description <span className="optional">optional</span><textarea name="description" defaultValue={need?.description || ''} rows="2" placeholder="A little more detail…" /></label>
    <div className="form-two-col"><label>Amount needed<input name="amount_needed" type="number" min="0.01" step="0.01" defaultValue={need?.amount_needed} required placeholder="0.00" /></label><label>Priority<select name="priority" defaultValue={need?.priority || 'medium'}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
    <div className="form-two-col"><label>Category<select name="category_id" defaultValue={need?.category_id || ''}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Target date<input name="deadline" type="date" defaultValue={need?.deadline || ''} /></label></div>
    <button type="button" className="inline-add" onClick={onAddCategory}><FolderPlus size={15} /> Create a category</button>
    <div className="recurrence-control"><label className="checkbox-label"><input type="checkbox" name="is_recurring" defaultChecked={need?.is_recurring || false} /> This is a recurring need</label><select name="recurrence_interval" defaultValue={need?.recurrence_interval || 'monthly'} aria-label="Recurrence interval"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="termly">Termly</option></select></div>
    <FormActions saving={saving} submitLabel={need ? 'Save changes' : 'Add need'} onCancel={onCancel} />
  </form>
}

function ContributionForm({ need, saving, onSubmit, onCancel }) {
  const remaining = Math.max(0, Number(need.amount_needed) - Number(need.amount_saved))
  return <form className="form-body" onSubmit={onSubmit}>
    <p className="form-context">Adding money toward <strong>{need.title}</strong>. {money(remaining)} left to reach your target.</p>
    <label>Contribution amount<input name="amount" type="number" min="0.01" max={remaining.toFixed(2)} step="0.01" required placeholder="0.00" autoFocus /></label>
    <label>Date<input name="contributed_on" type="date" defaultValue={today()} required /></label>
    <FormActions saving={saving} submitLabel="Record contribution" onCancel={onCancel} />
  </form>
}

function FundForm({ saving, onSubmit, onCancel }) {
  return <form className="form-body" onSubmit={onSubmit}>
    <label>Amount available<input name="amount_available" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label>
    <div className="form-two-col"><label>Period starts<input name="period_start" type="date" defaultValue={today()} required /></label><label>Period ends<input name="period_end" type="date" defaultValue={today()} required /></label></div>
    <label>Notes <span className="optional">optional</span><textarea name="notes" rows="2" placeholder="Where these funds came from…" /></label>
    <FormActions saving={saving} submitLabel="Save fund period" onCancel={onCancel} />
  </form>
}

function CategoryForm({ saving, onSubmit, onCancel }) {
  return <form className="form-body" onSubmit={onSubmit}>
    <label>Category name<input name="name" maxLength="50" required autoFocus placeholder="e.g. Home, Learning, Health" /></label>
    <FormActions saving={saving} submitLabel="Create category" onCancel={onCancel} />
  </form>
}

function FormActions({ saving, submitLabel, onCancel }) {
  return <div className="form-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving && <LoaderCircle className="spin" size={16} />}{submitLabel}</button></div>
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function modalTitle(modal) {
  if (modal.type === 'need') return modal.need ? 'Edit need' : 'Add a need'
  if (modal.type === 'contribution') return 'Add a contribution'
  if (modal.type === 'fund') return 'Log a fund period'
  return 'Create a category'
}

export default App
