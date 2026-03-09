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
import { AdminLayout } from './layouts/AdminLayout';
import { TvPlayerPage } from './pages/TvPlayerPage';
import { MachinesPage } from './pages/admin/MachinesPage';
import { MachineDetailPage } from './pages/admin/MachineDetailPage';
import { RevenuePage } from './pages/admin/RevenuePage';
import { UsersPage } from './pages/admin/UsersPage';
import { SongsAdminPage } from './pages/admin/SongsAdminPage';
import { SettingsPage } from './pages/admin/SettingsPage';

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />

      {/* Customer (authenticated) */}
      <Route element={<CustomerLayout />}>
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Route>

      {/* Admin Dashboard */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<MachinesPage />} />
        <Route path="/admin/machines/:id" element={<MachineDetailPage />} />
        <Route path="/admin/revenue" element={<RevenuePage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/songs" element={<SongsAdminPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
      </Route>

      {/* Bar Owner Dashboard */}
      <Route element={<BarOwnerLayout />}>
        <Route path="/owner" element={<MachineStatusPage />} />
        <Route path="/owner/revenue" element={<OwnerRevenuePage />} />
        <Route path="/owner/settings" element={<OwnerSettingsPage />} />
        <Route path="/owner/qr-code" element={<OwnerQRCodePage />} />
      </Route>

      {/* TV Player */}
      <Route path="/tv-player" element={<TvPlayerPage />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
