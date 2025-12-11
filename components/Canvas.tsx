import React from 'react';
import { CanvasComponent, ComponentType } from '../types';
import { ComponentRenderer } from './ComponentRenderer';

interface CanvasProps {
  components: CanvasComponent[];
  selectedComponentIds: string[];
  setSelectedComponentIds: (ids: string[]) => void;
  updateComponentPosition: (id:string, position: {x:number; y:number}) => void;
  updateComponentSize: (id: string, size: { width: number; height: number }) => void;
  updateComponentProps: (id: string, newProps: Record<string, any>) => void;
  onContextMenuOpen: (e: React.MouseEvent, component: CanvasComponent) => void;
  activeTool: ComponentType | null;
}

export const Canvas: React.FC<CanvasProps> = ({ components, selectedComponentIds, setSelectedComponentIds, updateComponentPosition, updateComponentSize, updateComponentProps, onContextMenuOpen, activeTool }) => {
  
  const handleSelect = (id: string, shiftKey: boolean) => {
    if (shiftKey) {
        setSelectedComponentIds(
            selectedComponentIds.includes(id)
                ? selectedComponentIds.filter(prevId => prevId !== id)
                : [...selectedComponentIds, id]
        );
    } else {
        if (!selectedComponentIds.includes(id)) {
            setSelectedComponentIds([id]);
        }
    }
  };
  
  const topLevelComponents = components.filter(c => !c.parentId);

  return (
    <>
      {topLevelComponents.map(component => (
        <ComponentRenderer
          key={component.id}
          component={component}
          allComponents={components}
          isSelected={selectedComponentIds.includes(component.id)}
          selectedComponentIds={selectedComponentIds}
          onSelect={handleSelect}
          onPositionChange={updateComponentPosition}
          onSizeChange={updateComponentSize}
          onPropsChange={updateComponentProps}
          onContextMenuOpen={onContextMenuOpen}
          activeTool={activeTool}
        />
      ))}
    </>
  );
};