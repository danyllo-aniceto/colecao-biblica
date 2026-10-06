import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

/** Regras do Duelo em poucas linhas. */
export function DuelHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Como jogar o Duelo" onClose={onClose} footer={<Button onClick={onClose}>Entendi</Button>}>
      <ul className="space-y-3 text-sm font-semibold text-ink">
        <li>🎯 <b>Objetivo:</b> ganhar 2 das 3 <b>arenas</b>. Em cada uma vence quem tiver mais <b>Influência</b> (o placar hexagonal: vermelho é do rival, verde é seu).</li>
        <li>⏱️ <b>6 turnos.</b> Em cada turno você tem <b>Vigor</b> igual ao número do turno (turno 3 = 3 de Vigor). O número azul da figurinha é o Vigor que ela custa.</li>
        <li>⚡ <b>Vigor guardado:</b> o que sobrar num turno <b>soma ao do próximo</b>, até o 6º. O painel de Vigor mostra quanto resta, de onde veio (turno, guardado, bônus de Dom) e quanto vai ficar guardado se você parar agora.</li>
        <li>🃏 <b>Jogue juntos:</b> escolha figurinhas da mão, coloque nas arenas (toque na figurinha e na arena, ou arraste) e toque em <b>Pronto</b>. As figurinhas viram ao mesmo tempo.</li>
        <li>✋ <b>Mudou de ideia?</b> Arraste uma figurinha já colocada para outra arena, ou solte fora das arenas (ou toque nela) para devolvê-la à mão. Só vale até o <b>Pronto</b>.</li>
        <li>🔒 <b>Arena fechada:</b> dá para jogar numa arena que ainda não apareceu, às cegas. A figurinha entra quando o turno acaba, mas o cenário só aparece no turno dele (e a regra dele passa a valer). Cuidado: ele pode ter menos espaço!</li>
        <li>🥇 <b>Quem está ganhando revela primeiro.</b> Todas as figurinhas do turno entram na mesa e só depois os Dons agem, na mesma ordem: assim quem age primeiro também pode atingir o que o rival jogou neste turno.</li>
        <li>✨ <b>Dom:</b> cada figurinha tem uma habilidade ligada à história dela. Toque numa figurinha da mão para ler o poder; as animações mostram o que cada Dom faz (o botão ⏩ acelera e o 🕘 mostra o que já aconteceu).</li>
        <li>🗺️ <b>Arenas:</b> a 1ª aparece no turno 1, a 2ª no turno 2 e a 3ª no turno 3. Cada uma tem uma regra, escrita nela. Toque para ler maior.</li>
        <li>🎲 <b>Quanto vale a rodada:</b> o selo <b>VALE ×N</b> no alto mostra a aposta e o que ela vale (pontos no Melhor de 3, dano nas Vidas). <b>Dobrar</b> multiplica por 2, uma vez por jogador por rodada. Quem recebe o dobro pode seguir ou <b>desistir</b>, perdendo só o que valia antes. Na rodada única não há aposta.</li>
        <li>⏳ <b>Tempo:</b> na sala online o relógio do turno aparece em anel ao lado da aposta. Quando acaba, o jogo diz "Pronto" por você com o que já estava colocado.</li>
        <li>🎬 <b>Acompanhe:</b> o que acontece em cada turno é mostrado passo a passo: figurinhas voando para outra arena (com seta), estourando, voltando à mão e números subindo ou descendo.</li>
        <li>🤝 É só diversão: não dá XP, moedas nem figurinhas.</li>
      </ul>
    </Modal>
  );
}
