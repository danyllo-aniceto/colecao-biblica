import { COMMON_POWER_UPS, EXTRA_SECONDS, MAX_POWER_UPS, POWER_UPS, PUSH_BACK, type ScenarioRules } from '@board/engine';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TILE_INFO, tileDescription, tileIcon, tileKindsOf } from '@/components/user/board/board-meta';

/** Regras do jogo e legenda das casas, no cenário em jogo. */
export function BoardHelp({ open, rules, onClose }: { open: boolean; rules: ScenarioRules; onClose: () => void }) {
  const powers = [...COMMON_POWER_UPS, ...(rules.exclusive ? [rules.exclusive] : [])];
  return (
    <Modal open={open} onClose={onClose} title="Como jogar" size="lg" footer={<Button onClick={onClose}>Entendi</Button>}>
      <div className="space-y-5 text-sm leading-6 text-ink">
        <ol className="list-decimal space-y-1 pl-5 font-semibold">
          <li>Na sua vez, role o dado.</li>
          <li>Cai uma pergunta: <b>acertou, o peão anda</b> o valor do dado; errou, fica parado.</li>
          <li>Quem cair na casa de um rival o empurra {PUSH_BACK} casas para trás (menos em abrigo e no portão).</li>
          <li>No portão, responda a <b>pergunta final</b>. Errou? Tente de novo na próxima vez. Acertou, venceu!</li>
        </ol>

        <section className="space-y-2">
          <h3 className="font-display text-base font-bold">Neste cenário</h3>
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="font-bold">
              {rules.vigil ? '🕯️' : '⚔️'} {rules.trial.name}
            </p>
            <p className="text-muted">{rules.trial.description}</p>
          </div>
          {rules.event ? (
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="font-bold">✨ {rules.event.name}</p>
              <p className="text-muted">{rules.event.description}</p>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-base font-bold">As casas</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {tileKindsOf(rules).map((kind) => (
              <li key={kind} className="flex items-start gap-2 rounded-2xl bg-surface-2 p-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 text-lg ${TILE_INFO[kind].className}`}>{tileIcon({ kind }, rules)}</span>
                <span>
                  <b>{TILE_INFO[kind].label}</b>
                  <span className="block text-xs text-muted">{tileDescription(kind, rules)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-base font-bold">Power-ups</h3>
          <p className="text-muted">A mochila guarda até {MAX_POWER_UPS}. Só um por vez (o tempo extra soma {EXTRA_SECONDS}s). Os escudos se gastam sozinhos.</p>
          <ul className="space-y-1">
            {powers.map((kind) => (
              <li key={kind}>
                <b>
                  {POWER_UPS[kind].emoji} {POWER_UPS[kind].name}
                </b>
                <span className="text-muted"> · {POWER_UPS[kind].description}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
