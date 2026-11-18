export type MenuState = { error?: string; success?: string; href?: string };
export type MenuFormKind =
  'category' | 'product' | 'variant' | 'group' | 'addon' | 'link' | 'image' | 'image_meta';
export type Choice = { id: string; name: string };
