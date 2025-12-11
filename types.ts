export interface WishState {
  text: string;
  loading: boolean;
  error: string | null;
}

export enum TreeMorphState {
  SCATTERED = 'SCATTERED',
  TREE_SHAPE = 'TREE_SHAPE'
}

export interface TreeConfig {
  rotationSpeed: number;
  bloomIntensity: number;
  lightsColor: string;
  morphState: TreeMorphState;
}

export enum CameraView {
  FULL = 'FULL',
  DETAIL = 'DETAIL',
  TOP = 'TOP'
}