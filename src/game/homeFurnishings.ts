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

export type FloorActivityKind = InteriorMinigameKind | 'rest';

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
    description: 'Tournament slate-bed pool table with green felt, cues, and full rack.',
    propKind: 'pool_table',
    activityKind: 'pool_8ball',
    activityLabel: '🎱 Home 8-Ball Billiards',
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
    name: 'Olympic Table Tennis Setup',
    icon: '🏓',
    price: 1650,
    category: 'Table Games',
    description: 'Regulation blue ping-pong table with spin-bot training partner.',
    propKind: 'table_tennis_table',
    activityKind: 'table_tennis',
    activityLabel: '🏓 Home Table Tennis',
    propWidth: 104,
    propHeight: 52,
  },
  {
    id: 'item_skeeball',
    name: 'LED Neon Skee-Ball Alley',
    icon: '🎳',
    price: 2600,
    category: 'Arcade Cabinets',
    description: 'Classic wooden boardwalk alley with glowing 100-point corner cups.',
    propKind: 'skeeball_lane',
    activityKind: 'skeeball',
    activityLabel: '🎳 Home Skee-Ball Lane',
    propWidth: 96,
    propHeight: 58,
  },
  {
    id: 'item_pinball',
    name: 'Cyber Neon Pinball Machine',
    icon: '⚡',
    price: 2750,
    category: 'Arcade Cabinets',
    description: 'Dual-flipper neon pinball table with bumpers, drop targets, and multi-score ramps.',
    propKind: 'pinball_machine',
    activityKind: 'pinball',
    activityLabel: '⚡ Home Cyber Pinball',
    propWidth: 66,
    propHeight: 56,
  },
  {
    id: 'item_arcade',
    name: 'Cyber Blaster DX Cabinet',
    icon: '🕹️',
    price: 1500,
    category: 'Arcade Cabinets',
    description: 'Upright CRT reflex blaster cabinet with combo multipliers.',
    propKind: 'arcade_cab',
    activityKind: 'arcade',
    activityLabel: '🕹️ Home Cyber Blaster DX',
    propWidth: 66,
    propHeight: 48,
  },
  {
    id: 'item_whack_a_bot',
    name: 'Whack-a-Bot Frenzy Unit',
    icon: '🔨',
    price: 1950,
    category: 'Arcade Cabinets',
    description: 'Fast-paced 9-pad mallet arcade game with gold crown bots & bomb decoys.',
    propKind: 'arcade_cab',
    activityKind: 'whack_a_bot',
    activityLabel: '🔨 Home Whack-a-Bot',
    propWidth: 66,
    propHeight: 48,
  },
  {
    id: 'item_claw',
    name: 'Super Prize Claw Machine',
    icon: '🧸',
    price: 2900,
    category: 'Arcade Cabinets',
    description: 'Illuminated glass crane stocked with custom plushies and trophies.',
    propKind: 'claw_box',
    activityKind: 'claw_machine',
    activityLabel: '🧸 Home Prize Claw',
    propWidth: 74,
    propHeight: 54,
  },
  {
    id: 'item_pop_a_shot',
    name: 'Pop-a-Shot Arcade Basketball',
    icon: '🏀',
    price: 2400,
    category: 'Sports & Simulators',
    description: 'Motorized moving backboard hoop rig with fire-streak moneyballs.',
    propKind: 'hoop_machine',
    activityKind: 'pop_a_shot',
    activityLabel: '🏀 Home Pop-a-Shot Hoops',
    propWidth: 76,
    propHeight: 50,
  },
  {
    id: 'item_dance_beat',
    name: 'Neon Dance Beat Floor Pad',
    icon: '🎵',
    price: 3100,
    category: 'Sports & Simulators',
    description: '4-arrow illuminated rhythm stage with combo chords and fever mode.',
    propKind: 'dance_stage',
    activityKind: 'dance_beat',
    activityLabel: '🎵 Home Dance Beat Stage',
    propWidth: 88,
    propHeight: 56,
  },
  {
    id: 'item_racing_sim',
    name: 'F1 Motion Racing Sim Cockpit',
    icon: '🏎️',
    price: 3800,
    category: 'Sports & Simulators',
    description: 'Full bucket-seat arcade racing simulator with turbo nitro & traffic dodge.',
    propKind: 'racing_sim',
    activityKind: 'racing_sim',
    activityLabel: '🏎️ Home Turbo Racing Sim',
    propWidth: 84,
    propHeight: 54,
  },
  {
    id: 'item_punch_bag',
    name: 'Heavyweight Boxer Speed Bag',
    icon: '🥊',
    price: 1400,
    category: 'Sports & Simulators',
    description: 'Arcade punching bag strength meter—nail the sweet spot for KO records.',
    propKind: 'punch_bag',
    activityKind: 'punch_bag',
    activityLabel: '🥊 Home Boxer Punch Bag',
    propWidth: 60,
    propHeight: 48,
  },
  {
    id: 'item_target_range',
    name: 'Laser Gallery Shooting Booth',
    icon: '🎯',
    price: 2100,
    category: 'Sports & Simulators',
    description: 'Three-tier moving arcade target gallery with golden drone bonuses.',
    propKind: 'arcade_cab',
    activityKind: 'target_range',
    activityLabel: '🎯 Home Laser Gallery',
    propWidth: 72,
    propHeight: 48,
  },
];

export function getHomeFurnishingById(id: string): HomeFurnishingItem | undefined {
  return HOME_FURNISHINGS_CATALOG.find((item) => item.id === id);
}
