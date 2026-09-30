import { useState } from 'react';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import GetAppRoundedIcon from '@mui/icons-material/GetAppRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import { Button } from '@/components/ui/button';
import { usePwa } from '@/components/pwa/pwa-provider';

/**
 * Botão "Instalar app". Usa o prompt nativo quando o navegador oferece (Android/desktop)
 * e mostra as instruções manuais no iPhone/iPad. Some quando o app já está instalado.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { canPromptInstall, promptInstall, isIos, isStandalone } = usePwa();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (isStandalone || (!canPromptInstall && !isIos)) {
    return null;
  }

  function handleClick() {
    if (canPromptInstall) {
      void promptInstall();
      return;
    }
    setShowIosHelp(true);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={handleClick} className={className}>
        <GetAppRoundedIcon fontSize="small" />
        Instalar app
      </Button>

      {showIosHelp ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <h3 id="ios-install-title" className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[var(--text-primary)]">
              Instalar no iPhone
            </h3>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <li className="flex items-start gap-3">
                <span className="font-semibold text-[var(--text-primary)]">1.</span>
                <span>
                  No Safari, toque em <strong className="text-[var(--text-primary)]">Compartilhar</strong>{' '}
                  <IosShareRoundedIcon fontSize="small" className="align-text-bottom text-[var(--accent)]" />
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-semibold text-[var(--text-primary)]">2.</span>
                <span>
                  Escolha <strong className="text-[var(--text-primary)]">Adicionar à Tela de Início</strong>{' '}
                  <AddBoxOutlinedIcon fontSize="small" className="align-text-bottom text-[var(--accent)]" />
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-semibold text-[var(--text-primary)]">3.</span>
                <span>Toque em <strong className="text-[var(--text-primary)]">Adicionar</strong>. O app aparece com o ícone da Coleção Bíblica.</span>
              </li>
            </ol>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setShowIosHelp(false)}>
                Entendi
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
