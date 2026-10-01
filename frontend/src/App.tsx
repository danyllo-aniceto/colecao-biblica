import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/components/providers/auth-provider';
import { PwaProvider } from '@/components/pwa/pwa-provider';
import { DialogProvider } from '@/components/ui/dialogs';
import { ToastProvider } from '@/components/ui/toast';
import { DashboardPage, PageLoading } from '@/pages/dashboard-page';
import { HomePage } from '@/pages/home-page';

// Detalhe da figurinha (texto rico e diagramas) em um arquivo à parte.
const StickerPage = lazy(() => import('@/pages/sticker-page').then((module) => ({ default: module.StickerPage })));

export function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <AuthProvider>
          <PwaProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/dashboard/figurinhas/:characterId"
                element={
                  <Suspense fallback={<PageLoading />}>
                    <StickerPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PwaProvider>
        </AuthProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
