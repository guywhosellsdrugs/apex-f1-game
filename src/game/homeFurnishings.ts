export type InteriorMinigameKind =
  | 'pool_8ball'
  | 'arcade'
  | 'skeeball'
  | 'air_hockey'
  | 'claw_machine'
  | 'whack_a_bot'
  | 'pop_a_shot'
  | 'pinball'
  | 'dance_beat'
  | 'racing_sim'
  | 'table_tennis'
  | 'punch_bag'
  | 'target_range';

export type WorkplaceShiftKind =
  | 'work_office'
  | 'work_clinic'
  | 'work_lab'
  | 'work_retail'
  | 'work_bank'
  | 'work_dispatch'
  | 'work_kitchen'
  | 'work_mechanic'
  | 'work_atc'
  | 'work_studio';

export type FloorActivityKind = InteriorMinigameKind | WorkplaceShiftKind | 'rest';

export function isWorkplaceShiftKind(kind: FloorActivityKind): kind is WorkplaceShiftKind {
  return (
    kind === 'work_office' ||
    kind === 'work_clinic' ||
    kind === 'work_lab' ||
    kind === 'work_retail' ||
    kind === 'work_bank' ||
    kind === 'work_dispatch' ||
    kind === 'work_kitchen' ||
    kind === 'work_mechanic' ||
    kind === 'work_atc' ||
    kind === 'work_studio'
  );
}

export type InteriorPropKind =
  | 'wall'
  | 'interior_wall'
  | 'pillar'
  | 'counter'
  | 'vault_wall'
  | 'glass_case'
  | 'shelf'
  | 'sofa'
  | 'bed'
  | 'table'
  | 'pool_table'
  | 'cooler'
  | 'piano'
  | 'kitchen_island'
  | 'desk'
  | 'arcade_cab'
  | 'air_hockey_table'
  | 'skeeball_lane'
  | 'claw_box'
  | 'hoop_machine'
  | 'pinball_machine'
  | 'dance_stage'
  | 'racing_sim'
  | 'table_tennis_table'
  | 'punch_bag';

export interface HomeFurnishingItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  category: 'Table Games' | 'Arcade Cabinets' | 'Sports & Simulators';
  description: string;
  propKind: InteriorPropKind;
  activityKind: InteriorMinigameKind;
  activityLabel: string;
  propWidth: number;
  propHeight: number;
}

export const HOME_FURNISHINGS_CATALOG: HomeFurnishingItem[] = [
  {
    id: 'item_pool_table',
    name: '8-Ball Championship Billiards Table',
    icon: '🎱',
    price: 1800,
    category: 'Table Games',
    description: 'Tournament slate-bed pool table with green felt, cues, and full vs-CPU match.',
    propKind: 'pool_table',
    activityKind: 'pool_8ball',
    activityLabel: '🎱 Home Billiards vs CPU',
    propWidth: 108,
    propHeight: 54,
  },
  {
    id: 'item_air_hockey',
    name: 'Neon Pro Air Hockey Table',
    icon: '🏒',
    price: 2200,
    category: 'Table Games',
    description: 'High-airflow glowing rink with mallets and automated CPU challenger.',
    propKind: 'air_hockey_table',
    activityKind: 'air_hockey',
    activityLabel: '🏒 Home Air Hockey Table',
    propWidth: 104,
    propHeight: 52,
  },
  {
    id: 'item_table_tennis',
    name: 'Olympic Ping Pong Table',
    icon: '🏓',
    price: 1650,
    category: 'Table Games',
    description: 'Regulation blue ping-pong table with spin-bot training partner.',
    propKind: 'table_tennis_table',
    activityKind: 'table_tennis',
    activityLabel: '🏓 Home Ping Pong Table',
    propWidth: 104,
    propHeight: 52,
  },
];

export function getHomeFurnishingById(id: string): HomeFurnishingItem | undefined {
  return HOME_FURNISHINGS_CATALOG.find((item) => item.id === id);
}
