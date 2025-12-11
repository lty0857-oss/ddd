export enum ComponentType {
  Button = 'Button',
  Input = 'Input',
  Listbox = 'Listbox',
  Tabs = 'Tabs',
  Dropdown = 'Dropdown',
  Radio = 'Radio',
  Checkbox = 'Checkbox',
  Toggle = 'Toggle',
  Slider = 'Slider',
  Alert = 'Alert',
  Loader = 'Loader',
  Progress = 'Progress',
  Tooltip = 'Tooltip',
  Modal = 'Modal',
  Popover = 'Popover',
  Icon = 'Icon',
  Text = 'Text',
  Image = 'Image',
  Container = 'Container',
  Accordion = 'Accordion',
  BarChart = 'BarChart',
  LineChart = 'LineChart',
  PieChart = 'PieChart',
  Group = 'Group',
  Misc = 'Misc',
}

export interface CanvasComponent {
  id: string;
  name: string;
  type: ComponentType;
  position: { x: number; y: number };
  props: Record<string, any>;
  size: { width: number; height: number };
  styles: Record<string, any>;
  description: string;
  parentId?: string;
  isLocked?: boolean;
}

export interface Preset {
  name: string;
  styles: Record<string, any>;
  props?: Record<string, any>;
  type?: 'functional' | 'style';
}