import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

/** Regras do Duelo em poucas linhas. */
export function DuelHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Como jogar o Duelo" onClose={onClose} footer={<Button onClick={onClose}>Entendi</Button>}>
      <ul className="space-y-3 text-sm font-semibold text-ink">
        <li>🎯 <b>Objetivo:</b> ganhar 2 dos 3 cenários. Em cada um vence quem tiver mais <b>Influência</b> (o número laranja das cartas).</li>
        <li>⏱️ <b>6 turnos.</b> Em cada turno você tem <b>Vigor</b> igual ao número do turno (turno 3 = 3 de Vigor). O número azul da carta é o Vigor que ela custa.</li>
        <li>🃏 <b>Jogue juntos:</b> escolha cartas da mão, coloque nos cenários (toque na carta e no cenário, ou arraste) e toque em <b>Pronto</b>. As cartas viram ao mesmo tempo.</li>
        <li>🥇 <b>Quem está ganhando revela primeiro.</b> A ordem importa para os Dons.</li>
        <li>✨ <b>Dom:</b> cada carta tem uma habilidade ligada à história dela. Toque numa carta para ler.</li>
        <li>🗺️ <b>Cenários:</b> o 1º aparece no turno 1, o 2º no turno 2 e o 3º no turno 3. Cada um tem uma regra.</li>
        <li>🎲 <b>Dobrar a aposta</b> vale mais na rodada. O rival pode <b>desistir</b> e perder só o que estava valendo.</li>
        <li>🤝 É só diversão: não dá XP, moedas nem figurinhas.</li>
      </ul>
    </Modal>
  );
}
