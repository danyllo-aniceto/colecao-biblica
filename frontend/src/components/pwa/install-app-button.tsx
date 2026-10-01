import { useState } from 'react';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import GetAppRoundedIcon from '@mui/icons-material/GetAppRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
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

      <Modal
        open={showIosHelp}
        size="sm"
        title="Instalar no iPhone"
        onClose={() => setShowIosHelp(false)}
        footer={<Button onClick={() => setShowIosHelp(false)}>Entendi</Button>}
      >
        <ol className="space-y-3 text-sm leading-6 text-muted">
          <li className="flex items-start gap-3">
            <span className="font-bold text-ink">1.</span>
            <span>
              No Safari, toque em <strong className="text-ink">Compartilhar</strong> <IosShareRoundedIcon fontSize="small" className="align-text-bottom text-accent" />
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-bold text-ink">2.</span>
            <span>
              Escolha <strong className="text-ink">Adicionar à Tela de Início</strong> <AddBoxOutlinedIcon fontSize="small" className="align-text-bottom text-accent" />
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-bold text-ink">3.</span>
            <span>
              Toque em <strong className="text-ink">Adicionar</strong>. O app aparece com o ícone da Coleção Bíblica.
            </span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
