import { useRef, useState } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, useToast } from '@/components/ui/toast';
import { uploadAudio } from '@/lib/uploads';

/** Música: enviar arquivo (até 4 MB), colar link, ouvir a prévia ou remover. */
export function AudioUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadAudio(file);
      onChange(result.url);
      toast.success('Música enviada.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function togglePreview() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    audio.play().catch(() => toast.error('Não foi possível tocar este arquivo. Confira o link ou o formato.'));
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={togglePreview}
        disabled={!value}
        aria-label={playing ? 'Pausar prévia' : 'Ouvir prévia'}
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-edge bg-surface-2 text-muted transition enabled:hover:bg-surface-3 enabled:hover:text-ink disabled:cursor-default"
      >
        {value ? playing ? <PauseRoundedIcon fontSize="large" /> : <PlayArrowRoundedIcon fontSize="large" /> : <MusicNoteRoundedIcon />}
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
            {uploading ? null : <UploadRoundedIcon fontSize="small" />}
            {value ? 'Trocar música' : 'Enviar música'}
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')} disabled={uploading}>
              <DeleteOutlineRoundedIcon fontSize="small" /> Remover
            </Button>
          ) : null}
        </div>
        <Input value={value} onChange={(event) => onChange(event.target.value.trim())} placeholder="ou cole o link do áudio (https://...)" />
        <input ref={inputRef} type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav" className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />
        {value ? <audio ref={audioRef} src={value} loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} preload="none" /> : null}
      </div>
    </div>
  );
}
