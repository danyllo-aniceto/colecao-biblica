import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import { Button } from '@/components/ui/button';
import {
  getIsIos,
  getIsStandalone,
  getOnlineStatus,
  isServiceWorkerSupported,
  SERVICE_WORKER_URL,
  subscribeDisplayMode,
  subscribeOnlineStatus,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa';

type PwaState = {
  isOnline: boolean;
  isStandalone: boolean;
  isIos: boolean;
  /** O navegador ofereceu a instalação (Chromium). */
  canPromptInstall: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  updateAvailable: boolean;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaState | undefined>(undefined);

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const noopSubscribe = () => () => {};

export function PwaProvider({ children }: { children: ReactNode }) {
  const isOnline = useSyncExternalStore(subscribeOnlineStatus, getOnlineStatus, () => true);
  const isStandalone = useSyncExternalStore(subscribeDisplayMode, getIsStandalone, () => false);
  const isIos = useSyncExternalStore(noopSubscribe, getIsIos, () => false);

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    function handleBeforeInstall(event: Event) {
      // Guarda o evento para exibir nosso próprio botão "Instalar app".
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallEvent(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      return;
    }

    // Em desenvolvimento o cache atrapalha o hot reload: remove qualquer worker antigo.
    if (!import.meta.env.PROD) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      });
      return;
    }

    let intervalId: number | undefined;
    let registration: ServiceWorkerRegistration | undefined;

    function trackInstalling(worker: ServiceWorker | null) {
      if (!worker) {
        return;
      }
      worker.addEventListener('statechange', () => {
        // Só é "atualização" se já havia uma versão controlando a página.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      });
    }

    function handleControllerChange() {
      if (reloadingRef.current) {
        window.location.reload();
      }
    }

    function checkForUpdate() {
      if (document.visibilityState === 'visible') {
        void registration?.update().catch(() => undefined);
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', checkForUpdate);

    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: '/' })
      .then((result) => {
        registration = result;

        if (result.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(result.waiting);
        }
        trackInstalling(result.installing);
        result.addEventListener('updatefound', () => trackInstalling(result.installing));

        intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      })
      .catch(() => {
        // Sem service worker o app continua funcionando normalmente, apenas sem modo offline.
      });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.clearInterval(intervalId);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) {
      return 'unavailable' as const;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    // O evento só pode ser usado uma vez.
    setInstallEvent(null);
    return choice.outcome;
  }, [installEvent]);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) {
      return;
    }
    reloadingRef.current = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }, [waitingWorker]);

  const value = useMemo<PwaState>(
    () => ({
      isOnline,
      isStandalone,
      isIos,
      canPromptInstall: installEvent !== null,
      promptInstall,
      updateAvailable: waitingWorker !== null,
      applyUpdate,
    }),
    [isOnline, isStandalone, isIos, installEvent, promptInstall, waitingWorker, applyUpdate],
  );

  return (
    <PwaContext.Provider value={value}>
      {!isOnline ? <OfflineBanner /> : null}
      {children}
      {waitingWorker ? <UpdateToast onUpdate={applyUpdate} onDismiss={() => setWaitingWorker(null)} /> : null}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within PwaProvider');
  }
  return context;
}

function OfflineBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 border-b border-edge bg-surface px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-xs font-semibold text-ink sm:text-sm"
    >
      <CloudOffRoundedIcon fontSize="small" className="text-accent" />
      <span>Você está offline. Mostrando os dados salvos; quiz e compras voltam quando a conexão retornar.</span>
    </div>
  );
}

function UpdateToast({ onUpdate, onDismiss }: { onUpdate: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="panel animate-pop-in fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-md items-center gap-3 p-4">
      <SystemUpdateAltRoundedIcon className="text-accent" />
      <p className="flex-1 font-display text-sm font-semibold text-ink">Uma nova versão do app está disponível.</p>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Depois
      </Button>
      <Button size="sm" onClick={onUpdate}>
        Atualizar
      </Button>
    </div>
  );
}
