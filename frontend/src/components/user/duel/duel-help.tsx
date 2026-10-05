import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

/** Regras do Duelo em poucas linhas. */
export function DuelHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Como jogar o Duelo" onClose={onClose} footer={<Button onClick={onClose}>Entendi</Button>}>
      <ul className="space-y-3 text-sm font-semibold text-ink">
        <li>🎯 <b>Objetivo:</b> ganhar 2 das 3 <b>arenas</b>. Em cada uma vence quem tiver mais <b>Influência</b> (o placar hexagonal: vermelho é do rival, verde é seu).</li>
        <li>⏱️ <b>6 turnos.</b> Em cada turno você tem <b>Vigor</b> igual ao número do turno (turno 3 = 3 de Vigor). O número azul da figurinha é o Vigor que ela custa.</li>
        <li>🃏 <b>Jogue juntos:</b> escolha figurinhas da mão, coloque nas arenas (toque na figurinha e na arena, ou arraste) e toque em <b>Pronto</b>. As figurinhas viram ao mesmo tempo.</li>
        <li>🥇 <b>Quem está ganhando revela primeiro.</b> A ordem importa para os Dons.</li>
        <li>✨ <b>Dom:</b> cada figurinha tem uma habilidade ligada à história dela. Toque numa figurinha da mão para ler o poder; as animações mostram o que cada Dom faz (o botão ⏩ acelera e o 🕘 mostra o que já aconteceu).</li>
        <li>🗺️ <b>Arenas:</b> a 1ª aparece no turno 1, a 2ª no turno 2 e a 3ª no turno 3. Cada uma tem uma regra, escrita nela. Toque para ler maior.</li>
        <li>🎲 <b>Dobrar a aposta</b> vale mais na rodada. O rival pode <b>desistir</b> e perder só o que estava valendo.</li>
        <li>🤝 É só diversão: não dá XP, moedas nem figurinhas.</li>
      </ul>
    </Modal>
  );
}
