export interface MapNode {
  id: string;
  row: number;
  col: number;
  edges_out: string[];
  slug: string;
  act: number;
}

export type MapData = MapNode[];
