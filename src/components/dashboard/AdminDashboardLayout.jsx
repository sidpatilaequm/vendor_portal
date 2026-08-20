import React from 'react';
import AdminLauncher from './AdminLauncher';

// Admin's entry point — the tile-based module launcher (see AdminLauncher.jsx)
// replaced the old sidebar shell so every admin screen is reachable through
// one pixel-consistent navigation surface instead of a nested sidebar menu.
const AdminDashboardLayout = () => <AdminLauncher />;

export default AdminDashboardLayout;
