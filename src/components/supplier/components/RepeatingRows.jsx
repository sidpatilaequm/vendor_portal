import React from 'react';

// Generic add/remove-row table used for the PDF's two repeating sections — Directors/
// Partners/Proprietor details, and Machinery & Other Equipment. Reuses the .contact card
// chrome (ContactCard.jsx) since visually it's the same "bordered card with a header row
// and a grid of inputs" shape.
const RepeatingRows = ({ title, rows, columns, template, onAdd, onUpdate, onRemove, addLabel }) => {
  return (
    <div style={{ marginTop: 16 }}>
      <label style={{ marginBottom: 8, display: 'block' }}>{title}</label>
      {rows.map((row, idx) => (
        <div className="contact" key={idx}>
          <div className="ch">
            <div className="cn">#{idx + 1}</div>
            <div className="cright">
              <button className="btn ghost sm" type="button" onClick={() => onRemove(idx)}>Remove</button>
            </div>
          </div>
          <div className="grid g2">
            {columns.map((col) => (
              <div key={col.key}>
                <label htmlFor={`${title}_${idx}_${col.key}`}>{col.label}</label>
                <input
                  id={`${title}_${idx}_${col.key}`}
                  type={col.type || 'text'}
                  className={col.mono ? 'mono' : ''}
                  value={row[col.key] || ''}
                  onChange={(e) => onUpdate(idx, col.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="btn ghost sm" type="button" onClick={() => onAdd({ ...template })}>{addLabel}</button>
    </div>
  );
};

export default RepeatingRows;
