import React from 'react';

/**
 * Standard "go back" affordance for every employee-facing screen — a standalone block above the
 * page header, always on the left, never sharing a row with action buttons (Create/Export/etc).
 * Mirrors the admin portal's own convention of keeping navigation (breadcrumb, top-left) fully
 * separate from actions (right side) rather than mixing the two in one flex row.
 */
const BackButton = ({ onClick, label = 'Back', className = '' }) => {
  if (!onClick) return null;
  return (
    <div
      onClick={onClick}
      className={`d-inline-flex align-items-center text-muted mb-3 cursor-pointer ${className}`}
      style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
    >
      <i className="fas fa-arrow-left me-2"></i>
      <span className="fw-medium">{label}</span>
    </div>
  );
};

export default BackButton;
