import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { BrowsePage } from './pages/BrowsePage';
import { QueuePage } from './pages/QueuePage';
import { WalletPage } from './pages/WalletPage';
import { ProfilePage } from './pages/ProfilePage';
import { HistoryPage } from './pages/HistoryPage';
import { CustomerLayout } from './layouts/CustomerLayout';
import { BarOwnerLayout } from './layouts/BarOwnerLayout';
import { MachineStatusPage } from './pages/owner/MachineStatusPage';
import { OwnerRevenuePage } from './pages/owner/OwnerRevenuePage';
import { OwnerSettingsPage } from './pages/owner/OwnerSettingsPage';
import { OwnerQRCodePage } from './pages/owner/OwnerQRCodePage';
import { OwnerAlertsPage } from './pages/owner/OwnerAlertsPage';
import { AdminLayout } from './layouts/AdminLayout';
import { TvPlayerPage } from './pages/TvPlayerPage';
import { MachinesPage } from './pages/admin/MachinesPage';
import { MachineDetailPage } from './pages/admin/MachineDetailPage';
import { AdminVenuesPage } from './pages/admin/AdminVenuesPage';
import { AdminVenueDetailPage } from './pages/admin/AdminVenueDetailPage';
import { AdminAlertsPage } from './pages/admin/AdminAlertsPage';
import { RevenuePage } from './pages/admin/RevenuePage';
import { UsersPage } from './pages/admin/UsersPage';
import { SongsAdminPage } from './pages/admin/SongsAdminPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminRegionsPage } from './pages/admin/AdminRegionsPage';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { EmployeeMachinesPage } from './pages/employee/EmployeeMachinesPage';
import { EmployeeVenuesPage } from './pages/employee/EmployeeVenuesPage';
import { EmployeeAlertsPage } from './pages/employee/EmployeeAlertsPage';
import { EmployeeRegisterVenuePage } from './pages/employee/EmployeeRegisterVenuePage';
import { EmployeeEarningsPage } from './pages/employee/EmployeeEarningsPage';
import { AffiliateLayout } from './layouts/AffiliateLayout';
import { AffiliateDashboardPage } from './pages/affiliate/AffiliateDashboardPage';
import { AffiliateCommissionsPage } from './pages/affiliate/AffiliateCommissionsPage';
import { AffiliateReferralsPage } from './pages/affiliate/AffiliateReferralsPage';
import { AffiliateQRCodePage } from './pages/affiliate/AffiliateQRCodePage';
import { SpecialEventsPage } from './pages/SpecialEventsPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { useAuthStore } from './stores/authStore';

export function App() {
  const { isAuthenticated, user, fetchMe, isLoading } = useAuthStore();
  const hasFetched = useRef(false);

  // Fetch user data once on app load if we have a token
  useEffect(() => {
    if (isAuthenticated && !user && !hasFetched.current) {
      hasFetched.current = true;
      fetchMe();
    }
  }, [isAuthenticated, user, fetchMe]);

  // Show loading screen only on initial auth check
  if (isAuthenticated && !user && isLoading) {
    return (
      <div className="min-h-screen bg-jb-bg-primary flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-jb-accent-green neon-text-green mb-4">JukeBox</h1>
          <div className="w-8 h-8 border-2 border-jb-accent-green border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/staff-login" element={<StaffLoginPage />} />

      {/* Customer (authenticated) */}
      <Route element={<CustomerLayout />}>
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/special" element={<SpecialEventsPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Route>

      {/* Admin Dashboard */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<MachinesPage />} />
        <Route path="/admin/machines/:id" element={<MachineDetailPage />} />
        <Route path="/admin/venues" element={<AdminVenuesPage />} />
        <Route path="/admin/venues/:id" element={<AdminVenueDetailPage />} />
        <Route path="/admin/alerts" element={<AdminAlertsPage />} />
        <Route path="/admin/revenue" element={<RevenuePage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/songs" element={<SongsAdminPage />} />
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route path="/admin/regions" element={<AdminRegionsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
      </Route>

      {/* Bar Owner Dashboard */}
      <Route element={<BarOwnerLayout />}>
        <Route path="/owner" element={<MachineStatusPage />} />
        <Route path="/owner/alerts" element={<OwnerAlertsPage />} />
        <Route path="/owner/revenue" element={<OwnerRevenuePage />} />
        <Route path="/owner/settings" element={<OwnerSettingsPage />} />
        <Route path="/owner/qr-code" element={<OwnerQRCodePage />} />
      </Route>

      {/* Employee Dashboard */}
      <Route element={<EmployeeLayout />}>
        <Route path="/employee" element={<EmployeeMachinesPage />} />
        <Route path="/employee/venues" element={<EmployeeVenuesPage />} />
        <Route path="/employee/alerts" element={<EmployeeAlertsPage />} />
        <Route path="/employee/register-venue" element={<EmployeeRegisterVenuePage />} />
        <Route path="/employee/earnings" element={<EmployeeEarningsPage />} />
      </Route>

      {/* Affiliate Dashboard */}
      <Route element={<AffiliateLayout />}>
        <Route path="/affiliate" element={<AffiliateDashboardPage />} />
        <Route path="/affiliate/commissions" element={<AffiliateCommissionsPage />} />
        <Route path="/affiliate/referrals" element={<AffiliateReferralsPage />} />
        <Route path="/affiliate/qr" element={<AffiliateQRCodePage />} />
      </Route>

      {/* TV Player */}
      <Route path="/tv-player" element={<TvPlayerPage />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
