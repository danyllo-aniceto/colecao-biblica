import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import { playSfx } from '@/lib/sound/sfx';
import { updateSoundSettings, useSoundSettings } from '@/lib/sound/settings';

/** Ajustes de som: efeitos dos botões e ações, música dos temas, volumes e a música de fora do quiz. */
export function SoundSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSoundSettings();
  const { campaign, current } = useCampaign();

  const scenarios = campaign?.scenarios.filter((scenario) => scenario.musicUrl || !scenario.musicUnlocked) ?? [];
  const options = [
    { value: 'auto', label: 'Automática', description: current ? `Segue o tema do seu nível (${current.name})` : 'Segue o tema do seu nível' },
    ...scenarios.map((scenario) => ({
      value: scenario.slug,
      label: scenario.name,
      description: scenario.musicUnlocked ? undefined : `Libera ao chegar ao nível ${scenario.startLevel ?? '?'}`,
      disabled: !scenario.musicUnlocked,
    })),
  ];
  const noMusicYet = campaign !== null && !campaign.scenarios.some((scenario) => scenario.musicUrl);

  return (
    <Modal
      open={open}
      size="sm"
      title="Sons e música"
      description="Vale só neste aparelho."
      onClose={onClose}
      footer={<Button onClick={onClose}>Pronto</Button>}
    >
      <div className="space-y-6">
        <section className="space-y-3" aria-label="Efeitos sonoros">
          <Switch
            checked={settings.sfxEnabled}
            onChange={(sfxEnabled) => updateSoundSettings({ sfxEnabled })}
            label="Sons dos botões e ações"
            description="Toques, virar a folha do álbum, acertos, erros e prêmios."
          />
          <div className="flex items-center gap-3">
            <Slider aria-label="Volume dos sons" value={Math.round(settings.sfxVolume * 100)} onChange={(value) => updateSoundSettings({ sfxVolume: value / 100 })} disabled={!settings.sfxEnabled} />
            <span className="w-10 shrink-0 text-right text-sm font-bold text-muted">{Math.round(settings.sfxVolume * 100)}%</span>
          </div>
          <Button size="sm" variant="secondary" disabled={!settings.sfxEnabled} data-sound="off" onClick={() => playSfx('reward')}>
            <TouchAppRoundedIcon fontSize="small" />
            Testar som
          </Button>
        </section>

        <section className="space-y-3 border-t border-edge pt-5" aria-label="Música">
          <Switch checked={settings.musicEnabled} onChange={(musicEnabled) => updateSoundSettings({ musicEnabled })} label="Música dos temas" description="Cada cenário da campanha tem a sua, liberada quando você chega nele." />
          <div className="flex items-center gap-3">
            <Slider aria-label="Volume da música" value={Math.round(settings.musicVolume * 100)} onChange={(value) => updateSoundSettings({ musicVolume: value / 100 })} disabled={!settings.musicEnabled} />
            <span className="w-10 shrink-0 text-right text-sm font-bold text-muted">{Math.round(settings.musicVolume * 100)}%</span>
          </div>
          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-sm font-bold text-muted">
              <MusicNoteRoundedIcon fontSize="small" /> Música fora do quiz
            </span>
            <Select aria-label="Música fora do quiz" value={settings.track} options={options} disabled={!settings.musicEnabled} onChange={(track) => updateSoundSettings({ track })} />
          </div>
          <Alert tone="info">No quiz toca sempre a música do tema do seu nível.</Alert>
          {noMusicYet ? <Alert tone="info">Nenhum cenário tem música cadastrada ainda.</Alert> : null}
        </section>
      </div>
    </Modal>
  );
}
