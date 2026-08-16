import React from 'react';

// Ported from become-a-supplier/app/become-a-supplier/components/Toast.tsx
const Toast = ({ html }) => <div className="toast" dangerouslySetInnerHTML={{ __html: html }} />;

export default Toast;
