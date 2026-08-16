import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import DashboardHome from './DashboardHome';
import PurchaseRequisition from './PurchaseRequisition';
import Quotation from './Quotation';
import PurchaseOrder from './PurchaseOrder';
import ASN from './ASN';
import Reports from './Reports';
import MaterialModule from './MaterialModule';
import AdminVendors from './AdminVendors';
import OnboardingComplianceDashboard from './OnboardingComplianceDashboard';
import PrApprovalReport from './PrApprovalReport';
import QuotationCycleReport from './QuotationCycleReport';
import AdminWorkflows from './AdminWorkflows';
import PurchaseOrderReport from './PurchaseOrderReport';
import MaterialReport from './MaterialReport';
import QuoteComparison from './QuoteComparison';
import IndentDashboard from './IndentDashboard';
import CreditNotesReport from './CreditNotesReport';
import MaterialStockReport from './MaterialStockReport';
import VendorReturnsReport from './VendorReturnsReport';
import VendorPaymentReport from './VendorPaymentReport';
import GateEntry from './GateEntry';
import VendorGateStatus from './VendorGateStatus';

const DashboardLayout = () => {
  const getInitialTab = () => {
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [tabProps, setTabProps] = useState({});
  const navigate = (tabId, props = {}) => {
    setActiveTab(tabId);
    setTabProps(props);
  };
  
  const getRoleFromStorage = () => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) return JSON.parse(userStr).role?.toUpperCase() || '';
    } catch (e) {}
    return '';
  };

  // Roles that use the full-screen card dashboard (no sidebar)
  const NO_SIDEBAR_ROLES = new Set(['VENDOR', 'VENDOR_ADMIN', 'EMPLOYEE', 'PURCHASE_DEPT']);

  const getInitialCollapse = () => NO_SIDEBAR_ROLES.has(getRoleFromStorage());

  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapse());

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardHome onNavigate={navigate} />;
      case 'pr':
        return <PurchaseRequisition mode="pr" onBack={() => setActiveTab('dashboard')} />;
      case 'rfq':
        return <PurchaseRequisition mode="rfq" onBack={() => setActiveTab('dashboard')} />;
      case 'quotation':
        return <Quotation onBack={() => navigate('dashboard')} onNavigate={navigate} />;
      case 'po':
        return <PurchaseOrder onBack={() => setActiveTab('dashboard')} />;
      case 'asn':
        return <ASN onBack={() => setActiveTab('dashboard')} />;
      case 'material':
        return <MaterialModule onBack={() => setActiveTab('dashboard')} />;
      case 'vendorList':
        return <AdminVendors onBack={() => setActiveTab('dashboard')} />;
      case 'reports':
        return <Reports onNavigate={navigate} />;
      case 'vendor-data':
        return <OnboardingComplianceDashboard onBack={() => setActiveTab('dashboard')} />;
      case 'admin-workflows':
        return <AdminWorkflows subTab="wf_dashboard" onNavigate={setActiveTab} />;
      case 'pr-approval-report':
        return <PrApprovalReport onBack={() => setActiveTab('dashboard')} />;
      case 'quotation-cycle-report':
        return <QuotationCycleReport onBack={() => setActiveTab('dashboard')} />;
      case 'purchase-order-report':
        return <PurchaseOrderReport onBack={() => setActiveTab('dashboard')} />;
      case 'material-report':
        return <MaterialReport onBack={() => setActiveTab('dashboard')} />;
      case 'quote-comparison':
        return <QuoteComparison onBack={() => navigate('quotation')} initialPrNumber={tabProps.initialPrNumber} />;
      case 'indent':
        return <IndentDashboard onBack={() => setActiveTab('dashboard')} />;
      case 'credit-note':
        return <CreditNotesReport onBack={() => setActiveTab('dashboard')} />;
      case 'stock':
        return <MaterialStockReport onBack={() => setActiveTab('dashboard')} />;
      case 'vendor-returns':
        return <VendorReturnsReport onBack={() => setActiveTab('dashboard')} />;
      case 'vendor-payment':
        return <VendorPaymentReport onBack={() => setActiveTab('dashboard')} />;
      case 'gate-entry':
        const userRole = getRoleFromStorage();
        if (userRole === 'VENDOR' || userRole === 'VENDOR_ADMIN') {
          return <VendorGateStatus onBack={() => setActiveTab('dashboard')} />;
        }
        return <GateEntry onBack={() => setActiveTab('dashboard')} />;
      default:
        return <DashboardHome />;
    }
  };

  const hideSidebar = NO_SIDEBAR_ROLES.has(getRoleFromStorage());


  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Header onNavigate={navigate} />
      <div className="d-flex flex-grow-1">
        {!hideSidebar && (
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            isCollapsed={isCollapsed}
            toggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        )}
        <main className="flex-grow-1 p-0 overflow-auto" style={{ height: 'calc(100vh - 70px)' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
