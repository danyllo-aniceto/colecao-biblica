import type { CSSProperties, ReactNode } from 'react';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import AnchorRoundedIcon from '@mui/icons-material/AnchorRounded';
import CastleRoundedIcon from '@mui/icons-material/CastleRounded';
import ChangeHistoryRoundedIcon from '@mui/icons-material/ChangeHistoryRounded';
import ChurchRoundedIcon from '@mui/icons-material/ChurchRounded';
import DirectionsBoatRoundedIcon from '@mui/icons-material/DirectionsBoatRounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import LandscapeRoundedIcon from '@mui/icons-material/LandscapeRounded';
import LocationCityRoundedIcon from '@mui/icons-material/LocationCityRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import ForestRoundedIcon from '@mui/icons-material/ForestRounded';
import FestivalRoundedIcon from '@mui/icons-material/FestivalRounded';
import FoundationRoundedIcon from '@mui/icons-material/FoundationRounded';
import ParkRoundedIcon from '@mui/icons-material/ParkRounded';
import GrassRoundedIcon from '@mui/icons-material/GrassRounded';
import HolidayVillageRoundedIcon from '@mui/icons-material/HolidayVillageRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import StairsRoundedIcon from '@mui/icons-material/StairsRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import BeachAccessRoundedIcon from '@mui/icons-material/BeachAccessRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import TheatersRoundedIcon from '@mui/icons-material/TheatersRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import SailingRoundedIcon from '@mui/icons-material/SailingRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarsRoundedIcon from '@mui/icons-material/StarsRounded';
import WavesRoundedIcon from '@mui/icons-material/WavesRounded';
import WbTwilightRoundedIcon from '@mui/icons-material/WbTwilightRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';

const DEFAULT_COLOR = '#7c4dff';

/** Ícone padrão de cada cenário (usado enquanto a arte própria não foi enviada). */
const FALLBACK_ICONS: Record<string, typeof MapRoundedIcon> = {
  eden: ParkRoundedIcon,
  arca: DirectionsBoatRoundedIcon,
  canaa: ExploreRoundedIcon,
  egito: ChangeHistoryRoundedIcon,
  sinai: LandscapeRoundedIcon,
  jerico: CastleRoundedIcon,
  templo: AccountBalanceRoundedIcon,
  babilonia: LocationCityRoundedIcon,
  galileia: AnchorRoundedIcon,
  jerusalem: ChurchRoundedIcon,
  babel: FoundationRoundedIcon,
  betel: StairsRoundedIcon,
  peniel: WbTwilightRoundedIcon,
  horebe: WhatshotRoundedIcon,
  tabernaculo: FestivalRoundedIcon,
  'cidade-davi': MusicNoteRoundedIcon,
  carmelo: TerrainRoundedIcon,
  'ossos-secos': AirRoundedIcon,
  pentecostes: HolidayVillageRoundedIcon,
  'campos-belem': GrassRoundedIcon,
  elim: WaterDropRoundedIcon,
  'monte-oliveiras': ForestRoundedIcon,
  'ur-caldeus': StarsRoundedIcon,
  susa: DiamondRoundedIcon,
  ninive: ApartmentRoundedIcon,
  transfiguracao: LightModeRoundedIcon,
  jordao: WavesRoundedIcon,
  manjedoura: StarRoundedIcon,
  damasco: RouteRoundedIcon,
  atenas: SchoolRoundedIcon,
  corinto: SailingRoundedIcon,
  efeso: TheatersRoundedIcon,
  filipos: LockOpenRoundedIcon,
  malta: BeachAccessRoundedIcon,
};

export function ScenarioFallbackIcon({ slug, className, fontSize = 28 }: { slug: string; className?: string; fontSize?: number }): ReactNode {
  const Icon = FALLBACK_ICONS[slug] ?? MapRoundedIcon;
  return <Icon className={className} sx={{ fontSize }} />;
}

/**
 * Arte do cenário. Vale a imagem cadastrada no painel; sem ela, o arquivo padrão
 * em `public/campaign/<slug>/map.png` e `icon.png`. Se nenhum existir, a tela usa o degradê do tema.
 */
export function scenarioMapSrc(scenario: { slug: string; mapImageUrl: string | null }) {
  return scenario.mapImageUrl ?? `/campaign/${scenario.slug}/map.png`;
}

export function scenarioIconSrc(scenario: { slug: string; iconImageUrl: string | null }) {
  return scenario.iconImageUrl ?? `/campaign/${scenario.slug}/icon.png`;
}

/** Cor (preto ou branco) legível sobre a cor do cenário. */
function readableOn(hex: string) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) || 0);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#2a1b00' : '#ffffff';
}

/**
 * Tema do cenário: troca os tokens do app (botões, destaques, superfícies, bordas e fundo)
 * por tons da cor do cenário, nos temas claro e escuro. Aplique em um ancestral.
 */
export function scenarioThemeVars(color?: string | null): CSSProperties {
  const base = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;
  return {
    '--primary': base,
    '--primary-soft': `color-mix(in srgb, ${base} 55%, white)`,
    '--primary-strong': `color-mix(in srgb, ${base} 70%, black)`,
    '--on-primary': readableOn(base),
    '--accent': base,
    '--accent-strong': `color-mix(in srgb, ${base} 70%, black)`,
    '--on-accent': readableOn(base),
    '--bg': `color-mix(in srgb, ${base} 14%, var(--surface))`,
    '--surface-2': `color-mix(in srgb, ${base} 9%, var(--surface))`,
    '--surface-3': `color-mix(in srgb, ${base} 18%, var(--surface))`,
    '--edge': `color-mix(in srgb, ${base} 30%, var(--surface))`,
    '--edge-strong': `color-mix(in srgb, ${base} 45%, var(--surface))`,
  } as CSSProperties;
}

/** Fundo do mapa quando o cenário ainda não tem arte: céu e chão na cor do cenário. */
export function scenarioFallbackBackground(color?: string | null) {
  const base = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;
  return `linear-gradient(180deg, color-mix(in srgb, ${base} 18%, white) 0%, color-mix(in srgb, ${base} 40%, white) 55%, color-mix(in srgb, ${base} 70%, black) 100%)`;
}
