import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import QuestionnaireBuilder from './QuestionnaireBuilder';
import './questionnaire-studio.css';

// List view for the questionnaire builder — create/open/duplicate/set-active/delete a process.
// Follows Quotation.jsx's pattern: a selected-id state conditionally swaps the list for a
// full-screen detail/builder view instead of routing or a modal.
const ACTIVE_KEY = 'become_a_supplier';

const Questionnaire = () => {
  const [processes, setProcesses] = useState([]);
  const [draftCounts, setDraftCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [creatingName, setCreatingName] = useState(null); // null = modal closed, '' = open+empty
  const [creating, setCreating] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await axios.get('/api/questionnaire/processes', { headers: authHeaders() });
      const list = Array.isArray(data) ? data : [];
      setProcesses(list);
      // Form Studio's own response_count only counts *submitted* answers — a draft in progress
      // never becomes a response row until submit, so it needs its own lookup (backend_java,
      // not Form Studio, since only backend_java's supplier_registration table knows about drafts).
      const counts = await Promise.all(
        list.map((p) =>
          axios
            .get(`/api/questionnaire/${p.id}/draft-count`, { headers: authHeaders() })
            .then((r) => [p.id, r.data.draftCount])
            .catch(() => [p.id, 0])
        )
      );
      setDraftCounts(Object.fromEntries(counts));
    } catch (err) {
      console.error('Failed to load questionnaires', err);
      const status = err.response?.status;
      setLoadError(
        status === 401 || status === 403
          ? 'Your session could not be verified — try signing in again.'
          : 'Could not reach the server — check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  const createProcess = async () => {
    if (!creatingName || !creatingName.trim()) return;
    setCreating(true);
    try {
      const { data } = await axios.post(
        '/api/questionnaire/processes',
        { name: creatingName.trim(), status: 'draft' },
        { headers: authHeaders() }
      );
      setCreatingName(null);
      setSelectedProcessId(data.id);
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not create the questionnaire.');
    } finally {
      setCreating(false);
    }
  };

  const duplicateProcess = async (id) => {
    try {
      await axios.post(`/api/questionnaire/processes/${id}/duplicate`, null, { headers: authHeaders() });
      fetchProcesses();
    } catch (err) {
      alert('Could not duplicate this questionnaire.');
    }
  };

  const deleteProcess = async (id) => {
    if (!window.confirm('Delete this questionnaire?')) return;
    try {
      await axios.delete(`/api/questionnaire/processes/${id}`, { headers: authHeaders() });
      fetchProcesses();
    } catch (err) {
      const detail = err.response?.data?.detail;
      alert(typeof detail === 'string' ? detail : 'Could not delete this questionnaire.');
    }
  };

  const setActive = async (id) => {
    try {
      await axios.patch(`/api/questionnaire/processes/${id}/activate`, null, {
        params: { key: ACTIVE_KEY },
        headers: authHeaders(),
      });
      fetchProcesses();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not activate — publish it first.');
    }
  };

  if (selectedProcessId) {
    return (
      <QuestionnaireBuilder
        processId={selectedProcessId}
        onBack={() => { setSelectedProcessId(null); fetchProcesses(); }}
      />
    );
  }

  return (
    <div className="qstudio">
      <div className="qs-page">
        <div className="qs-stack">
          <div className="workspace-head">
            <div className="row-actions" style={{ justifyContent: 'space-between' }}>
              <div>
                <h1 className="qs-display">Questionnaires</h1>
                <p className="qs-lede">Whichever questionnaire is marked "Active" shows up as a section on the Become-a-Supplier page.</p>
              </div>
              <button className="btn btn--primary" onClick={() => setCreatingName('')}>+ New questionnaire</button>
            </div>
          </div>

          {loading ? (
            <p className="qs-muted">Loading…</p>
          ) : loadError ? (
            <div className="qs-empty">
              <p className="qs-empty__title" style={{ color: 'var(--stamp)' }}>Couldn't load questionnaires.</p>
              <p className="qs-muted">{loadError}</p>
              <button className="btn" style={{ marginTop: 10 }} onClick={fetchProcesses}>Try again</button>
            </div>
          ) : processes.length === 0 ? (
            <div className="qs-empty">
              <p className="qs-empty__title">No questionnaires yet.</p>
              <p className="qs-muted">Create one to get started.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <table className="qs-list-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Sections</th>
                    <th>Questions</th>
                    <th>Responses</th>
                    <th>Drafts in progress</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button className="qs-name-link" onClick={() => setSelectedProcessId(p.id)}>{p.name}</button>
                      </td>
                      <td><span className={`chip chip--${p.status}`}>{p.status}</span></td>
                      <td className="qs-code">{p.section_count}</td>
                      <td className="qs-code">{p.question_count}</td>
                      <td className="qs-code">{p.response_count}</td>
                      <td>
                        {draftCounts[p.id] > 0
                          ? <span className="stamp">{draftCounts[p.id]} draft{draftCounts[p.id] === 1 ? '' : 's'}</span>
                          : <span className="qs-code">0</span>}
                      </td>
                      <td>
                        {p.external_key === ACTIVE_KEY ? (
                          <span className="chip chip--published">Active</span>
                        ) : (
                          <button
                            className="btn btn--tiny"
                            disabled={p.status !== 'published'}
                            onClick={() => setActive(p.id)}
                            title={p.status !== 'published' ? 'Publish it first' : 'Make this the live questionnaire'}
                          >
                            Set active
                          </button>
                        )}
                      </td>
                      <td className="row-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button className="btn btn--tiny" onClick={() => setSelectedProcessId(p.id)}>Open</button>
                        <button className="btn btn--tiny" onClick={() => duplicateProcess(p.id)}>Duplicate</button>
                        <button
                          className="btn btn--tiny btn--danger"
                          onClick={() => deleteProcess(p.id)}
                          disabled={p.response_count > 0 || draftCounts[p.id] > 0}
                          title={p.response_count > 0 || draftCounts[p.id] > 0 ? "Has responses or drafts in progress — can't be deleted" : undefined}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {creatingName !== null && (
        <div className="qstudio" style={{ position: 'fixed', inset: 0, background: 'rgba(21,34,46,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCreatingName(null)}>
          <div className="card" style={{ width: 420, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <p className="qs-eyebrow">New questionnaire</p>
            <label className="field">
              <span className="label">Name</span>
              <input
                className="input"
                autoFocus
                value={creatingName}
                onChange={(e) => setCreatingName(e.target.value)}
                placeholder="e.g. Supplier compliance questionnaire"
                onKeyDown={(e) => e.key === 'Enter' && createProcess()}
              />
            </label>
            <div className="row-actions" style={{ marginTop: 8 }}>
              <button className="btn btn--primary" disabled={creating} onClick={createProcess}>{creating ? 'Creating…' : 'Create'}</button>
              <button className="btn btn--ghost" onClick={() => setCreatingName(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Questionnaire;
