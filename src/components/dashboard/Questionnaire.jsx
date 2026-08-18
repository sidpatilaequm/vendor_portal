import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import QuestionnaireBuilder from './QuestionnaireBuilder';

// List view for the questionnaire builder — create/open/duplicate/set-active/delete a process.
// Follows Quotation.jsx's pattern: a selected-id state conditionally swaps the list for a
// full-screen detail/builder view instead of routing or a modal.
const ACTIVE_KEY = 'become_a_supplier';

const Questionnaire = () => {
  const [processes, setProcesses] = useState([]);
  const [draftCounts, setDraftCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  const createProcess = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await axios.post(
        '/api/questionnaire/processes',
        { name: newName.trim(), status: 'draft' },
        { headers: authHeaders() }
      );
      setShowNewModal(false);
      setNewName('');
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
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0">Questionnaires</h4>
          <p className="text-muted small mb-0">
            Whichever questionnaire is marked "Active" shows up as a section on the Become-a-Supplier page.
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>+ New questionnaire</Button>
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : processes.length === 0 ? (
        <div className="text-muted">No questionnaires yet — create one to get started.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
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
                  <td className="fw-semibold">{p.name}</td>
                  <td>
                    <span className={`badge ${p.status === 'published' ? 'bg-success' : p.status === 'closed' ? 'bg-secondary' : 'bg-warning text-dark'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.section_count}</td>
                  <td>{p.question_count}</td>
                  <td>{p.response_count}</td>
                  <td>
                    {draftCounts[p.id] > 0 ? (
                      <span className="badge bg-warning text-dark">{draftCounts[p.id]}</span>
                    ) : (
                      0
                    )}
                  </td>
                  <td>
                    {p.external_key === ACTIVE_KEY ? (
                      <span className="badge bg-primary">Active for Become-a-Supplier</span>
                    ) : (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={p.status !== 'published'}
                        onClick={() => setActive(p.id)}
                        title={p.status !== 'published' ? 'Publish it first' : 'Make this the live questionnaire'}
                      >
                        Set active
                      </button>
                    )}
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setSelectedProcessId(p.id)}>Open</button>
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => duplicateProcess(p.id)}>Duplicate</button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteProcess(p.id)}
                      disabled={p.response_count > 0 || draftCounts[p.id] > 0}
                      title={p.response_count > 0 || draftCounts[p.id] > 0 ? 'Has responses or drafts in progress — can\'t be deleted' : undefined}
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

      <Modal
        show={showNewModal}
        title="New questionnaire"
        onClose={() => setShowNewModal(false)}
        onSubmit={createProcess}
        submitText="Create"
        loading={creating}
      >
        <Input
          label="Name"
          id="newQuestionnaireName"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Supplier compliance questionnaire"
        />
      </Modal>
    </div>
  );
};

export default Questionnaire;
