import React, { useState, useCallback, MouseEvent, useEffect, useRef } from 'react';
import { Toolbox } from './components/Toolbox';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CanvasComponent, ComponentType, Preset } from './types';
import { DEFAULT_PROPS, TOOLBOX_COMPONENTS } from './constants';
import { LogoIcon, SaveIcon, RedoIcon, UndoIcon, DocumentTextIcon, CodeBracketIcon, FolderOpenIcon, SparklesIcon, ChevronsUpIcon, ChevronUpIcon, ChevronsDownIcon, ChevronDownIcon, DuplicateIcon, TrashIcon, PhotoIcon, GroupIcon, UngroupIcon, Bars3Icon, LockClosedIcon, LockOpenIcon, QuestionMarkCircleIcon, XMarkIcon } from './components/icons';
import useHistoryState from './hooks/useHistoryState';
import { LayersPanel } from './components/LayersPanel';
import { GoogleGenAI, Type } from "@google/genai";
import { fileToBase64 } from './utils/image';

declare const html2canvas: any;

const isValidComponentsArray = (arr: any): arr is CanvasComponent[] => {
    if (!Array.isArray(arr)) return false;
    if (arr.length === 0) return true;
    return arr.every(item => 
        item &&
        typeof item === 'object' &&
        'id' in item &&
        'type' in item &&
        'name' in item &&
        'description' in item &&
        item.position && typeof item.position === 'object' && 'x' in item.position && 'y' in item.position &&
        item.size && typeof item.size === 'object' && 'width' in item.size && 'height' in item.size &&
        item.props && typeof item.props === 'object' &&
        item.styles && typeof item.styles === 'object'
    );
};

const ContextMenu: React.FC<{
  x: number;
  y: number;
  component: CanvasComponent;
  onMoveLayer: (direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  canGroup: boolean;
  onGroup: () => void;
  canUngroup: boolean;
  onUngroup: () => void;
  onToggleLock: () => void;
}> = ({ x, y, component, onMoveLayer, onDuplicate, onDelete, onClose, canGroup, onGroup, canUngroup, onUngroup, onToggleLock }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menuSections: (({
    label: string;
    action: () => void;
    icon: React.FC<any>;
    isDestructive?: boolean;
  })[])[] = [];

  const layerActions = [
    { label: '맨 앞으로', action: () => handleAction(() => onMoveLayer('top')), icon: ChevronsUpIcon },
    { label: '앞으로', action: () => handleAction(() => onMoveLayer('up')), icon: ChevronUpIcon },
    { label: '뒤로', action: () => handleAction(() => onMoveLayer('down')), icon: ChevronDownIcon },
    { label: '맨 뒤로', action: () => handleAction(() => onMoveLayer('bottom')), icon: ChevronsDownIcon },
  ];
  menuSections.push(layerActions);

  const groupActions = [];
  if (canGroup) groupActions.push({ label: '그룹', action: () => handleAction(onGroup), icon: GroupIcon });
  if (canUngroup) groupActions.push({ label: '그룹 해제', action: () => handleAction(onUngroup), icon: UngroupIcon });
  if (groupActions.length > 0) menuSections.push(groupActions);

  const generalActions = [
      { label: '복제', action: () => handleAction(onDuplicate), icon: DuplicateIcon },
      { label: '삭제', action: () => handleAction(onDelete), icon: TrashIcon, isDestructive: true },
  ];
  
  if (component.type === ComponentType.Container) {
    generalActions.unshift({
        label: component.isLocked ? '잠금 해제' : '잠금',
        action: () => handleAction(onToggleLock),
        icon: component.isLocked ? LockOpenIcon : LockClosedIcon,
    });
  }

  menuSections.push(generalActions);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1"
      style={{ top: y, left: x }}
    >
      {menuSections.map((section, sectionIndex) => (
        <React.Fragment key={sectionIndex}>
          {sectionIndex > 0 && <div className="border-t border-gray-700 my-1" />}
          {section.map((item, itemIndex) => (
            <button
              key={itemIndex}
              onClick={item.action}
              className={`w-full flex items-center px-4 py-2 text-sm text-left ${item.isDestructive ? 'text-red-400 hover:bg-red-500 hover:text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              <item.icon className="w-4 h-4 mr-3" />
              <span>{item.label}</span>
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

interface LeftSidebarProps {
    activeTool: ComponentType | null;
    setActiveTool: (tool: ComponentType | null) => void;
    components: CanvasComponent[];
    selectedComponentIds: string[];
    onSelect: (id: string) => void;
    onMoveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
    onDelete: (id: string) => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'components' | 'layers'>('components');

    return (
        <aside className="w-64 bg-gray-900 border-r border-gray-700 flex-shrink-0 flex flex-col">
            <div className="flex border-b border-gray-700 flex-shrink-0">
                <button
                    onClick={() => setActiveTab('components')}
                    className={`flex-1 p-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'components' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                >
                    <SparklesIcon className="w-5 h-5" />
                    <span>컴포넌트</span>
                </button>
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 p-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'layers' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                >
                    <Bars3Icon className="w-5 h-5" />
                    <span>레이어</span>
                </button>
            </div>

            {activeTab === 'components' ? (
                <Toolbox
                    activeTool={props.activeTool}
                    setActiveTool={props.setActiveTool}
                />
            ) : (
                <LayersPanel
                    components={props.components}
                    selectedComponentIds={props.selectedComponentIds}
                    onSelect={props.onSelect}
                    onMoveLayer={props.onMoveLayer}
                    onDelete={props.onDelete}
                />
            )}
        </aside>
    );
};


const App: React.FC = () => {
  const [components, setComponents, undo, redo, canUndo, canRedo] = useHistoryState<CanvasComponent[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ComponentType | null>(null);
  const [drawingState, setDrawingState] = useState<{ start: { x: number; y: number }, end: { x: number; y: number } } | null>(null);
  const [marqueeState, setMarqueeState] = useState<{ start: { x: number; y: number }, end: { x: number; y: number } } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageImportInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [screenDescription, setScreenDescription] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiImageLoading, setIsAiImageLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; component: CanvasComponent } | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const handleOpenContextMenu = (e: React.MouseEvent, component: CanvasComponent) => {
    if (!mainRef.current) return;
    const mainRect = mainRef.current.getBoundingClientRect();
    setContextMenu({
      x: e.clientX - mainRect.left,
      y: e.clientY - mainRect.top,
      component,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const createComponent = useCallback((type: ComponentType, position: {x: number, y: number}, size: {width: number, height: number}) => {
    const defaultData = DEFAULT_PROPS.find(p => p.type === type);
    if (!defaultData) return;
    
    const count = components.filter(c => c.type === type).length + 1;
    const name = `${type}${count}`;
    
    const props = { ...defaultData.props };

    if ([ComponentType.BarChart, ComponentType.LineChart, ComponentType.PieChart].includes(type)) {
      const generateRandomChartData = () => {
        const data = [];
        const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        const count = Math.floor(Math.random() * 4) + 4; // 4 to 7 data points
        for (let i = 0; i < count; i++) {
          data.push({
            name: categories[i],
            value1: Math.floor(Math.random() * 80) + 20,
            value2: Math.floor(Math.random() * 60) + 15,
          });
        }
        return data;
      };
      props.data = generateRandomChartData();
    }

    const newComponent: CanvasComponent = {
      id: `${type}-${Date.now()}`,
      name,
      type,
      position,
      props: props,
      size: { ...size },
      styles: { ...defaultData.styles },
      description: '',
      isLocked: defaultData.isLocked,
    };

    setComponents(prev => [...prev, newComponent]);
    setSelectedComponentIds([newComponent.id]);
    setActiveTool(null);
  }, [components, setComponents]);
  
  const handleCanvasMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const canvasRect = e.currentTarget.getBoundingClientRect();
    const startPos = {
        x: e.clientX - canvasRect.left,
        y: e.clientY - canvasRect.top,
    };

    if (activeTool) {
        setDrawingState({ start: startPos, end: startPos });
    } else {
        setMarqueeState({ start: startPos, end: startPos });
        setSelectedComponentIds([]);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
        if (!drawingState || !canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const currentPos = {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top,
        };
        setDrawingState(prev => (prev ? { ...prev, end: currentPos } : null));
    };

    const handleGlobalMouseUp = () => {
        if (drawingState && activeTool) {
            const { start, end } = drawingState;
            const newComponentPosition = {
                x: Math.min(start.x, end.x),
                y: Math.min(start.y, end.y),
            };
            const newComponentSize = {
                width: Math.abs(start.x - end.x),
                height: Math.abs(start.y - end.y),
            };
            if (newComponentSize.width > 5 && newComponentSize.height > 5) {
                createComponent(activeTool, newComponentPosition, newComponentSize);
            } else {
                setActiveTool(null);
            }
        }
        setDrawingState(null);
    };

    if (drawingState) {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [drawingState, activeTool, createComponent]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
        if (!marqueeState || !canvasRef.current) return;
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const currentPos = {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top,
        };
        setMarqueeState(prev => (prev ? { ...prev, end: currentPos } : null));
    };

    const handleGlobalMouseUp = () => {
        if (marqueeState) {
            const { start, end } = marqueeState;
            const marqueeRect = {
                x: Math.min(start.x, end.x),
                y: Math.min(start.y, end.y),
                width: Math.abs(start.x - end.x),
                height: Math.abs(start.y - end.y),
            };

            if (marqueeRect.width > 5 || marqueeRect.height > 5) {
                const selected = components
                    .filter(c => !c.parentId && !c.isLocked)
                    .filter(c => {
                        const componentRect = { ...c.position, ...c.size };
                        return (
                            componentRect.x < marqueeRect.x + marqueeRect.width &&
                            componentRect.x + componentRect.width > marqueeRect.x &&
                            componentRect.y < marqueeRect.y + marqueeRect.height &&
                            componentRect.y + componentRect.height > marqueeRect.y
                        );
                    })
                    .map(c => c.id);
                setSelectedComponentIds(selected);
            }
        }
        setMarqueeState(null);
    };

    if (marqueeState) {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [marqueeState, components, setSelectedComponentIds]);


  const updateComponent = (id: string, updates: Partial<CanvasComponent>) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  const updateComponentProps = useCallback((id: string, newProps: Record<string, any>) => {
     setComponents(prev => prev.map(c => c.id === id ? { ...c, props: { ...c.props, ...newProps } } : c));
  }, [setComponents]);

  const updateComponentPosition = useCallback((id: string, newPosition: { x: number; y: number }) => {
    setComponents(prev => prev.map(c => (c.id === id ? { ...c, position: newPosition } : c)), true);
  }, [setComponents]);

  const updateComponentSize = useCallback((id: string, newSize: { width: number; height: number }) => {
    setComponents(prev => prev.map(c => (c.id === id ? { ...c, size: newSize } : c)), true);
  }, [setComponents]);

  const updateComponentStyles = useCallback((id: string, newStyles: Record<string, any>) => {
    setComponents(prev => prev.map(c => (c.id === id ? { ...c, styles: { ...c.styles, ...newStyles } } : c)));
  }, [setComponents]);
  
  const updateComponentDescription = useCallback((id: string, description: string) => {
    setComponents(prev => prev.map(c => (c.id === id ? { ...c, description } : c)));
  }, [setComponents]);

  const updateComponentName = useCallback((id: string, name: string) => {
    setComponents(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));
  }, [setComponents]);
  
  const handleToggleLock = useCallback((id: string) => {
    setComponents(prev => 
        prev.map(c => c.id === id ? { ...c, isLocked: !c.isLocked } : c)
    );
  }, [setComponents]);

  const applyComponentPreset = useCallback((id: string, preset: Preset) => {
      setComponents(prev =>
          prev.map(c => {
              if (c.id === id) {
                  const shouldResetProps = c.type === ComponentType.Button && preset.type === 'functional';
                  
                  const baseProps = shouldResetProps
                      ? DEFAULT_PROPS.find(p => p.type === c.type)?.props || {}
                      : c.props;

                  return {
                      ...c,
                      styles: { ...c.styles, ...preset.styles },
                      props: { ...baseProps, ...(preset.props || {}) },
                  };
              }
              return c;
          })
      );
  }, [setComponents]);

  const deleteComponent = useCallback((idToDelete: string) => {
      setComponents(prev => {
          const idsToDelete = new Set<string>([idToDelete]);
          const componentToDelete = prev.find(c => c.id === idToDelete);

          if (componentToDelete?.type === ComponentType.Group) {
              const findChildrenRecursive = (parentId: string) => {
                  const children = prev.filter(c => c.parentId === parentId);
                  children.forEach(child => {
                      idsToDelete.add(child.id);
                      if (child.type === ComponentType.Group) {
                          findChildrenRecursive(child.id);
                      }
                  });
              };
              findChildrenRecursive(idToDelete);
          }

          return prev.filter(c => !idsToDelete.has(c.id));
      });
      setSelectedComponentIds(prev => prev.filter(id => id !== idToDelete));
  }, [setComponents, setSelectedComponentIds]);

  const duplicateComponent = useCallback((id: string) => {
      const componentToDuplicate = components.find(c => c.id === id);
      if (!componentToDuplicate) return;

      const newComponents: CanvasComponent[] = [];
      const idMapping: Record<string, string> = {};

      const duplicateRecursive = (componentId: string, newParentId?: string) => {
          const original = components.find(c => c.id === componentId)!;
          const newId = `${original.type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          idMapping[original.id] = newId;

          const count = components.filter(c => c.type === original.type).length + newComponents.filter(c => c.type === original.type).length + 1;

          const newComponent: CanvasComponent = {
              ...original,
              id: newId,
              name: `${original.name} 복사본`,
              parentId: newParentId,
              position: newParentId ? { ...original.position } : { x: original.position.x + 20, y: original.position.y + 20 },
          };
          newComponents.push(newComponent);

          if (original.type === ComponentType.Group) {
              const children = components.filter(c => c.parentId === original.id);
              children.forEach(child => duplicateRecursive(child.id, newId));
          }
      };

      duplicateRecursive(id);
      setComponents(prev => [...prev, ...newComponents]);
      setSelectedComponentIds([idMapping[id]]);
  }, [components, setComponents, setSelectedComponentIds]);

  const moveComponentLayer = useCallback((id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      setComponents(prev => {
          const index = prev.findIndex(c => c.id === id);
          if (index === -1) return prev;

          const newComponents = [...prev];
          const [component] = newComponents.splice(index, 1);

          if (direction === 'up') {
              newComponents.splice(Math.min(index + 1, newComponents.length), 0, component);
          } else if (direction === 'down') {
              newComponents.splice(Math.max(index - 1, 0), 0, component);
          } else if (direction === 'top') {
              newComponents.push(component);
          } else if (direction === 'bottom') {
              newComponents.unshift(component);
          }
          return newComponents;
      });
  }, [setComponents]);

  const handleGroup = useCallback(() => {
    if (selectedComponentIds.length <= 1) return;

    const selectedComps = components.filter(c => selectedComponentIds.includes(c.id));
    if (selectedComps.some(c => c.parentId)) {
        alert("이미 그룹에 속한 컴포넌트는 그룹화할 수 없습니다.");
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    selectedComps.forEach(c => {
        minX = Math.min(minX, c.position.x);
        minY = Math.min(minY, c.position.y);
        maxX = Math.max(maxX, c.position.x + c.size.width);
        maxY = Math.max(maxY, c.position.y + c.size.height);
    });

    const groupPosition = { x: minX, y: minY };
    const groupSize = { width: maxX - minX, height: maxY - minY };
    const groupDefault = DEFAULT_PROPS.find(p => p.type === ComponentType.Group)!;
    const groupCount = components.filter(c => c.type === ComponentType.Group).length + 1;
    const newGroup: CanvasComponent = {
        id: `Group-${Date.now()}`,
        name: `그룹 ${groupCount}`,
        type: ComponentType.Group,
        position: groupPosition,
        size: groupSize,
        props: { ...groupDefault.props },
        styles: { ...groupDefault.styles },
        description: '',
        isLocked: false,
    };

    setComponents(prev => {
        const newComps = prev.map(c => {
            if (selectedComponentIds.includes(c.id)) {
                return {
                    ...c,
                    parentId: newGroup.id,
                    position: {
                        x: c.position.x - groupPosition.x,
                        y: c.position.y - groupPosition.y,
                    },
                };
            }
            return c;
        });
        return [...newComps, newGroup];
    });

    setSelectedComponentIds([newGroup.id]);
  }, [selectedComponentIds, components, setComponents, setSelectedComponentIds]);

  const handleUngroup = useCallback(() => {
      if (selectedComponentIds.length !== 1) return;
      const groupId = selectedComponentIds[0];
      const group = components.find(c => c.id === groupId);
      if (!group || group.type !== ComponentType.Group) return;

      const childrenIds: string[] = [];
      setComponents(prev => {
          const groupPos = group.position;
          return prev
              .map(c => {
                  if (c.parentId === groupId) {
                      childrenIds.push(c.id);
                      return {
                          ...c,
                          parentId: undefined,
                          position: {
                              x: c.position.x + groupPos.x,
                              y: c.position.y + groupPos.y,
                          },
                      };
                  }
                  return c;
              })
              .filter(c => c.id !== groupId);
      });
      setSelectedComponentIds(childrenIds);
  }, [selectedComponentIds, components, setComponents, setSelectedComponentIds]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
            return;
        }

        const activeElement = document.activeElement;
        const isEditingText = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            (activeElement as HTMLElement).isContentEditable
        );

        if (isEditingText) {
            return;
        }

        const lastSelectedId = selectedComponentIds[selectedComponentIds.length - 1];
        if (lastSelectedId) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                selectedComponentIds.forEach(id => deleteComponent(id));
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                duplicateComponent(lastSelectedId);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'g' && selectedComponentIds.length > 1) {
              e.preventDefault();
              handleGroup();
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'g') {
              const component = components.find(c => c.id === lastSelectedId);
              if (component && component.type === ComponentType.Group) {
                e.preventDefault();
                handleUngroup();
              }
            }


            const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
            if (isArrowKey && selectedComponentIds.length === 1) {
                e.preventDefault();
                const component = components.find(c => c.id === lastSelectedId);
                if (component) {
                    const amount = e.shiftKey ? 10 : 1;
                    let newX = component.position.x;
                    let newY = component.position.y;
                    if (e.key === 'ArrowUp') newY -= amount;
                    if (e.key === 'ArrowDown') newY += amount;
                    if (e.key === 'ArrowLeft') newX -= amount;
                    if (e.key === 'ArrowRight') newX += amount;
                    setComponents(prev => prev.map(c => (c.id === lastSelectedId ? { ...c, position: {x: newX, y: newY} } : c)), true);
                }
            }
        }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
        const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
        if (isArrowKey && selectedComponentIds.length === 1) {
             const component = components.find(c => c.id === selectedComponentIds[0]);
             if (component) {
                setComponents([...components], false);
             }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    }
  }, [selectedComponentIds, components, deleteComponent, duplicateComponent, undo, redo, setComponents, handleGroup, handleUngroup]);

  const handleSaveAsImage = async () => {
    if (!canvasRef.current) return;
    const previousSelectedIds = [...selectedComponentIds];
    setSelectedComponentIds([]); 
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const canvas = await html2canvas(canvasRef.current, { backgroundColor: null });
        const link = document.createElement('a');
        link.download = 'design.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("이미지 저장에 실패했습니다.", err);
    } finally {
        setSelectedComponentIds(previousSelectedIds);
    }
  };
  
  const handleSaveComponentInfo = () => {
    const dataStr = JSON.stringify(components, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'components.json';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveDesignSpec = () => {
    if (!appName.trim() || !appDescription.trim()) {
      alert('애플리케이션 이름과 설명을 입력해주세요.');
      return;
    }
    const specData = {
      application: { name: appName, description: appDescription },
      screen: { name: "Main Screen", description: screenDescription },
      components: components,
    };
    const dataStr = JSON.stringify(specData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'design-spec.json';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let loadedComponents: CanvasComponent[] | null = null;
    let finalAppName = '';
    let finalAppDescription = '';
    let finalScreenDescription = '';
    let foundValidComponents = false;
    let foundValidSpec = false;

    const readFile = (file: File): Promise<string> => 
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (typeof e.target?.result === 'string') {
            resolve(e.target.result);
          } else {
            reject(new Error(`'${file.name}' 파일 내용을 읽을 수 없습니다.`));
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
      });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (!file) continue;
        
        const fileContent = await readFile(file);
        const data = JSON.parse(fileContent);

        let componentsFromFile: CanvasComponent[] | null = null;
        if (isValidComponentsArray(data)) {
            componentsFromFile = data;
        } else if (data && typeof data === 'object' && !Array.isArray(data) && 'components' in data && isValidComponentsArray(data.components)) {
            componentsFromFile = data.components;
        }

        if (componentsFromFile) {
            loadedComponents = componentsFromFile;
            foundValidComponents = true;
        }

        if (data && typeof data === 'object' && !Array.isArray(data) && ('application' in data || 'screen' in data)) {
          if (data.application?.name !== undefined) finalAppName = data.application.name;
          if (data.application?.description !== undefined) finalAppDescription = data.application.description;
          if (data.screen?.description !== undefined) finalScreenDescription = data.screen.description;
          foundValidSpec = true;
        }
      }
      
      if (foundValidComponents && !foundValidSpec) {
          finalAppName = '';
          finalAppDescription = '';
          finalScreenDescription = '';
      }

      if (foundValidComponents) {
        setComponents(loadedComponents!);
        setAppName(finalAppName);
        setAppDescription(finalAppDescription);
        setScreenDescription(finalScreenDescription);
        setSelectedComponentIds([]);
        alert(`파일 ${files.length}개를 성공적으로 불러왔습니다.`);
      } else {
        throw new Error("지원하지 않는 JSON 파일 형식입니다. 유효한 컴포넌트 데이터를 찾을 수 없습니다.");
      }

    } catch (error) {
        console.error("JSON 파일 불러오기 또는 파싱 실패:", error);
        alert(`파일을 불러오는 데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const handleGetAISuggestions = async () => {
    if (!components.length) {
      alert('AI 제안을 받으려면 캔버스에 컴포넌트를 하나 이상 추가해주세요.');
      return;
    }
    setIsAiLoading(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const simplifiedComponents = components.map(c => ({
            name: c.name,
            type: c.type,
            purpose: c.description,
            text: c.props.text || c.props.placeholder,
            position: c.position,
            size: c.size,
        }));
        
        const prompt = `
            다음은 UI 디자인 편집기로 만든 웹 애플리케이션 화면의 컴포넌트 목록입니다.
            이 정보를 바탕으로, 이 애플리케이션의 이름, 상세 설명(목적, 주요 기능, 대상 사용자 포함), 그리고 현재 화면의 역할 및 동작 방식을 한국어로 제안해주세요.
            결과는 반드시 지정된 JSON 형식으로 응답해야 합니다.

            컴포넌트 정보:
            ${JSON.stringify(simplifiedComponents, null, 2)}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        appName: { type: Type.STRING, description: '애플리케이션의 이름' },
                        appDescription: { type: Type.STRING, description: '애플리케이션의 목적, 주요 기능, 대상 사용자를 포함한 상세 설명' },
                        screenDescription: { type: Type.STRING, description: '현재 화면의 역할과 동작 방식에 대한 설명' }
                    },
                    required: ["appName", "appDescription", "screenDescription"]
                }
            }
        });

        const result = JSON.parse(response.text);
        setAppName(result.appName);
        setAppDescription(result.appDescription);
        setScreenDescription(result.screenDescription);

    } catch (error) {
        console.error("AI 제안 생성 실패:", error);
        alert("AI 제안을 받아오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleImageImportClick = () => {
    imageImportInputRef.current?.click();
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAiImageLoading(true);
    try {
        const base64Data = await fileToBase64(file);
        const mimeType = file.type;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const imagePart = { inlineData: { mimeType, data: base64Data } };

        const availableComponentTypes = TOOLBOX_COMPONENTS.map(c => c.type);

        const canvasWidth = canvasRef.current?.clientWidth || 1280;
        const canvasHeight = canvasRef.current?.clientHeight || 800;
        
        const prompt = `
            당신은 사용자의 의도를 파악하고 UI의 기능적 구조를 분석하는 데 특화된 세계 최고 수준의 AI UI/UX 아키텍트입니다. 당신의 임무는 제공된 UI 스크린샷 이미지를 분석하여, 단순한 시각적 복제를 넘어 기능적으로 동작하고 상호 연결된 컴포넌트 시스템으로 리버스 엔지니어링하는 것입니다. 최종 결과물은 화면의 심층적인 디자인 명세와 구조화된 컴포넌트 배열을 포함하는 단일 JSON 객체여야 합니다.

            사용 가능한 컴포넌트 타입:
            ${JSON.stringify(availableComponentTypes)}

            **최종 목표 작업 영역 크기: ${canvasWidth}px 너비, ${canvasHeight}px 높이**

            지침:

            1. **심층 디자인 명세 분석 (Design Spec Analysis):**
                * **앱 이름 ('appName'):** 이미지에 보이는 이름이 있더라도, 그 본질을 포착하는 독창적이고 새로운 애플리케이션 이름을 한국어로 창조하세요. **절대로 이미지에 있는 이름을 그대로 사용하지 마세요.** (예: 'Spotify' 이미지 -> '멜로디스트림' 또는 '튠웨이브'로 제안)
                * **앱 상세 설명 ('appDescription'):** 이 앱의 핵심 가치 제안, 주요 사용자 여정, 그리고 타겟 사용자 페르소나를 포함하여 상세하고 설득력 있는 설명을 한국어로 작성하세요.
                * **화면 설명 ('screenDescription'):** 이 특정 화면의 주요 목표는 무엇인지, 사용자가 화면과 상호작용하는 일반적인 흐름은 어떻게 되는지, 그리고 그 상호작용의 예상 결과는 무엇인지 구체적으로 설명하세요.

            2. **지능적인 컴포넌트 분석 및 관계 추론 (Intelligent Component Analysis & Relationship Inference):**
                * **최우선 과제: 영역 구분 및 컨테이너 활용 (Top Priority: Area Distinction & Container Usage):**
                    - 이미지의 레이아웃을 분석하여 헤더, 사이드바, 메인 콘텐츠, 카드, 폼 등 논리적인 영역을 식별하세요.
                    - 식별된 각 영역을 **반드시** 'Container' 타입 컴포넌트로 감싸주세요. 이는 구조화된 디자인을 만드는 데 가장 중요한 단계입니다.
                    - 예를 들어, 상단의 내비게이션 요소들은 'Header_Container' 안에, 상품 정보는 'ProductCard_Container' 안에 배치되어야 합니다.
                    - 컨테이너는 중첩될 수 있습니다. (예: 'MainContent_Container' 안에 여러 개의 'Card_Container'가 있을 수 있습니다.)

                * **컴포넌트 식별:** 이미지의 모든 주요 UI 요소를 식별하고, 제공된 목록에서 가장 적합한 'type'을 할당합니다.
                
                * **작업 영역에 최적화된 위치 및 크기 (Workspace-Optimized Position & Size):**
                    - 원본 이미지의 크기에 상관없이, 모든 컴포넌트의 위치(x, y)와 크기(width, height)를 위에 명시된 **'최종 목표 작업 영역 크기'(${canvasWidth}x${canvasHeight})에 맞게** 비례적으로 조정하여 추정해야 합니다.
                    - 컴포넌트들이 작업 영역 내에 보기 좋게 배치되도록 전체적인 레이아웃을 최적화하세요. 너무 크거나 작거나, 화면 밖으로 벗어나는 컴포넌트가 없어야 합니다.

                * **상태 및 관계 추론 (매우 중요):** 이것이 가장 중요한 부분입니다. 컴포넌트들을 개별적으로 보지 말고, 서로 어떻게 연관되어 있는지 추론하세요.
                    - **상호작용:** '필터' 버튼이 '상품 목록'을 변경합니까? '탭' 컴포넌트가 아래의 '컨텐츠 컨테이너'의 가시성을 제어합니까?
                    - **상태 반영:** 활성화된 내비게이션 버튼이나 선택된 탭이 있습니까? 그렇다면 해당 컴포넌트의 'props' (예: 'activeTab: 1')나 스타일 프리셋을 적용하여 그 상태를 반영해야 합니다. 예를 들어, 여러 버튼 중 하나만 활성 상태로 보여야 합니다.
                    - **데이터 흐름:** 사용자가 '입력 필드'에 텍스트를 입력하고 '검색 버튼'을 누르는 흐름을 고려하여 각 컴포넌트의 'description'을 작성하세요.
                * **의미 있는 속성 ('props') 추출:** 단순히 텍스트를 복사하지 말고, 그것이 'text'인지 'placeholder'인지, 혹은 'title'인지 의미를 파악하여 'props' 객체에 할당하세요.
                * **체계적인 이름 ('name') 부여:** "Header_NavButton_Home", "ProductCard_AddToCart_Button"처럼 명확하고 계층적인 네이밍 컨벤션을 사용하세요.
                * **상세한 설명 ('description') 작성:** 컴포넌트의 역할, 가능한 상태(기본, 호버, 비활성 등), 그리고 사용자가 상호작용했을 때 어떤 일이 발생하는지를 설명하는 상세한 'description'을 제공하세요.
                * **스타일:** 복잡한 스타일은 복제하지 말고, 기본 스타일 값을 사용하세요. 기능적 구조와 관계에 집중합니다.

            3. **엄격한 응답 형식 (Strict Response Format):**
                * 반드시 제공된 스키마를 준수하는 단일 JSON 객체로만 응답해야 합니다.
                * JSON 객체는 'designSpec'과 'components' 두 개의 최상위 키를 가져야 합니다.
                * JSON 응답 외에 어떠한 설명, 노트, 마크다운 형식도 포함해서는 안 됩니다.
        `;

        const componentSchema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING, enum: availableComponentTypes },
                position: {
                    type: Type.OBJECT,
                    properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                    },
                    required: ['x', 'y'],
                },
                size: {
                    type: Type.OBJECT,
                    properties: {
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                    },
                    required: ['width', 'height'],
                },
                props: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        placeholder: { type: Type.STRING },
                        tabs: { type: Type.ARRAY, items: { type: Type.STRING } },
                        activeTab: { type: Type.INTEGER }
                    },
                },
                description: { type: Type.STRING },
            },
            required: ['name', 'type', 'position', 'size', 'props', 'description'],
        };
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                designSpec: {
                    type: Type.OBJECT,
                    properties: {
                        appName: { type: Type.STRING, description: '애플리케이션의 이름' },
                        appDescription: { type: Type.STRING, description: '애플리케이션의 목적, 주요 기능, 대상 사용자를 포함한 상세 설명' },
                        screenDescription: { type: Type.STRING, description: '현재 화면의 역할과 동작 방식에 대한 설명' }
                    },
                    required: ["appName", "appDescription", "screenDescription"]
                },
                components: {
                    type: Type.ARRAY,
                    items: componentSchema
                }
            },
            required: ["designSpec", "components"]
        };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [ { text: prompt }, imagePart ] },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const result = JSON.parse(response.text);

        if (!result || typeof result !== 'object' || !result.designSpec || !Array.isArray(result.components)) {
            throw new Error("AI 응답이 유효한 형식이 아닙니다. 'designSpec' 객체와 'components' 배열을 포함해야 합니다.");
        }

        const { designSpec, components: generatedComponentsData } = result;

        setAppName(designSpec.appName);
        setAppDescription(designSpec.appDescription);
        setScreenDescription(designSpec.screenDescription);
        
        const newComponents: CanvasComponent[] = generatedComponentsData.map((data: any) => {
            const defaultData = DEFAULT_PROPS.find(p => p.type === data.type);
            if (!defaultData) return null;

            return {
                id: `${data.type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                name: data.name,
                type: data.type,
                position: data.position,
                size: data.size,
                description: data.description,
                props: { ...defaultData.props, ...(data.props || {}) },
                styles: { ...defaultData.styles },
                isLocked: defaultData.isLocked,
            };
        }).filter((c): c is CanvasComponent => c !== null);

        setComponents(newComponents);
        setSelectedComponentIds([]);
        alert('이미지에서 UI와 디자인 명세를 성공적으로 생성했습니다!');

    } catch (error) {
        console.error("AI 이미지 분석 실패:", error);
        alert(`AI 이미지 분석에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
        setIsAiImageLoading(false);
        if (imageImportInputRef.current) {
            imageImportInputRef.current.value = '';
        }
    }
  };

  const selectedComponent = components.find(c => c.id === selectedComponentIds[selectedComponentIds.length - 1]) || null;
  const lastSelectedComponent = selectedComponentIds.length === 1 ? components.find(c => c.id === selectedComponentIds[0]) : null;

  return (
    <div className="bg-gray-800 text-white h-screen w-screen flex flex-col overflow-hidden">
        {isAiImageLoading && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex flex-col items-center justify-center z-50">
                <SparklesIcon className="w-12 h-12 text-purple-400 animate-spin" />
                <p className="mt-4 text-lg text-white">AI가 이미지를 분석하고 있습니다...</p>
                <p className="mt-2 text-sm text-gray-400">잠시만 기다려주세요. UI 컴포넌트와 디자인 명세를 생성하고 있습니다.</p>
            </div>
        )}
         {isHelpModalOpen && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50" onClick={() => setIsHelpModalOpen(false)}>
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <LogoIcon className="w-6 h-6 text-blue-400"/>
                            GPT PARK의 UI 캔버스 Pro :: 도움말
                        </h2>
                        <button onClick={() => setIsHelpModalOpen(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto panel-scrollbar space-y-6 text-gray-300">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">개요 및 설명</h3>
                            <p className="text-sm">
                                GPT PARK의 UI 캔버스 Pro는 기획자, 디자이너, 개발자 모두를 위한 웹 애플리케이션 UI 시각화 및 설계 도구입니다. 포토샵과 유사한 직관적인 인터페이스를 통해 아이디어를 빠르게 프로토타입으로 만들 수 있습니다. 드래그 앤 드롭으로 컴포넌트를 배치하고, 실시간으로 속성을 변경하며, 완성된 디자인을 이미지나 체계적인 JSON 명세서로 내보내 디자인과 개발 간의 간극을 줄일 수 있습니다. 특히, 강력한 AI 기능을 탑재하여 기존 디자인 이미지로부터 UI를 자동으로 생성하거나, 현재 캔버스 디자인을 분석하여 명세서를 자동으로 작성하는 등 설계 프로세스를 혁신적으로 단축시켜 줍니다.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-3">주요 기능</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li><b>다양한 컴포넌트:</b> 버튼, 입력 필드, 차트 등 20가지가 넘는 필수 UI 컴포넌트를 제공하며, 모든 컴포넌트는 우측 속성 패널에서 자유롭게 커스터마이징할 수 있습니다.</li>
                                <li><b>직관적인 드래그 & 드롭:</b> 도구 상자에서 원하는 컴포넌트를 선택한 후 캔버스 위에서 직접 드래그하여 원하는 크기와 위치에 바로 생성할 수 있어 매우 빠르고 직관적입니다.</li>
                                <li><b>실시간 속성 편집:</b> 컴포넌트를 선택하면 우측 패널에 크기, 색상, 텍스트 스타일과 같은 공통 속성은 물론, 탭 항목, 버튼 아이콘 등 각 컴포넌트의 고유 속성까지 즉시 수정할 수 있는 인터페이스가 나타납니다.</li>
                                <li><b>체계적인 레이어 관리:</b> 레이어 패널에서 컴포넌트 목록을 트리 구조로 확인하고, Z-축 순서를 변경하며, 여러 컴포넌트를 그룹으로 묶어 복잡한 UI 구조를 효율적으로 관리할 수 있습니다.</li>
                                <li><b>AI 기반 디자인 생성:</b> UI 스크린샷 이미지를 업로드하면 AI가 이미지를 심층 분석하여 단순한 시각적 복제를 넘어, 기능적으로 동작하는 컴포넌트들의 조합으로 캔버스 위에 자동으로 재구성하고 디자인 명세까지 작성해줍니다.</li>
                                <li><b>AI 기반 명세서 작성:</b> 캔버스에 배치된 컴포넌트들의 구성과 내용을 기반으로, AI가 애플리케이션의 이름, 상세 설명, 그리고 현재 화면의 역할과 사용자 시나리오까지 논리적으로 추론하여 제안합니다.</li>
                                <li><b>유연한 내보내기/불러오기:</b> 작업 결과물을 시각적 공유를 위한 PNG 이미지, 데이터 보존을 위한 컴포넌트 JSON, 또는 개발 핸드오프를 위한 전체 디자인 명세 JSON 등 다양한 형식으로 저장하고 언제든지 다시 불러와 작업을 이어갈 수 있습니다.</li>
                            </ul>
                        </div>
                         <div>
                            <h3 className="text-xl font-bold text-white mb-3">상세 사용법</h3>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li><b>컴포넌트 추가:</b> 1. 좌측 사이드바에서 '컴포넌트' 탭을 선택합니다. 2. 원하는 컴포넌트 아이콘을 클릭하여 활성화합니다. 3. 캔버스 위에서 마우스를 클릭하고 드래그하여 원하는 크기의 컴포넌트를 생성합니다.</li>
                                <li><b>컴포넌트 선택 및 이동:</b> <b>단일 선택:</b> 컴포넌트를 클릭합니다. <b>다중 선택:</b> `Shift` 키를 누른 상태에서 여러 컴포넌트를 클릭하거나, 캔버스의 빈 공간에서 드래그하여 여러 컴포넌트를 포함하는 선택 영역을 만듭니다. <b>이동:</b> 선택된 컴포넌트(들)을 드래그하여 위치를 변경합니다.</li>
                                <li><b>컴포넌트 수정:</b> 컴포넌트를 선택하면 우측 사이드바가 자동으로 '속성' 탭으로 전환됩니다. 이곳에서 이름, 설명, 크기, 위치, 색상, 텍스트 스타일 등 다양한 속성을 실시간으로 수정할 수 있습니다. 각 컴포넌트의 고유한 속성(예: 탭 항목, 버튼 아이콘)도 이곳에서 설정합니다.</li>
                                <li><b>레이어 순서 변경:</b> 좌측 '레이어' 탭으로 전환하면 캔버스의 모든 컴포넌트가 목록으로 표시됩니다. 컴포넌트를 선택한 후 패널 하단의 화살표 아이콘을 사용하여 Z-축 순서(맨 앞/뒤로 보내기)를 조정할 수 있습니다.</li>
                                <li><b>그룹화/그룹 해제:</b> 여러 컴포넌트를 선택한 후, 마우스 오른쪽 버튼을 클릭하여 나타나는 컨텍스트 메뉴에서 '그룹'을 선택하여 하나의 그룹으로 묶을 수 있습니다. 그룹을 선택하고 동일한 메뉴에서 '그룹 해제'를 선택하여 개별 컴포넌트로 되돌릴 수 있습니다.</li>
                                <li><b>컨텍스트 메뉴:</b> 캔버스 위의 컴포넌트를 마우스 오른쪽 버튼으로 클릭하면 복제, 삭제, 레이어 순서 변경, 잠금/잠금 해제, 그룹화/그룹 해제 등 자주 사용하는 기능에 빠르게 접근할 수 있는 메뉴가 나타납니다.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" multiple />
        <input type="file" ref={imageImportInputRef} onChange={handleImageFileChange} style={{ display: 'none' }} accept="image/png, image/jpeg, image/webp" />
        <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 z-10">
            <div className="flex items-center gap-2">
                <LogoIcon className="h-6 w-6 text-blue-400" />
                <h1 className="text-lg font-semibold">GPT PARK의 UI 캔버스 Pro</h1>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                    <button onClick={undo} disabled={!canUndo} title="실행 취소 (Ctrl+Z)" className="p-1.5 disabled:text-gray-600 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-700 rounded"><UndoIcon className="w-5 h-5" /></button>
                    <button onClick={redo} disabled={!canRedo} title="다시 실행 (Ctrl+Shift+Z)" className="p-1.5 disabled:text-gray-600 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-700 rounded"><RedoIcon className="w-5 h-5" /></button>
                </div>
                <button onClick={handleImageImportClick} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md font-semibold transition-colors" title="이미지에서 불러오기">
                    <PhotoIcon className="h-4 w-4" />
                    이미지
                </button>
                <button onClick={handleLoadClick} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md font-semibold transition-colors" title="디자인 불러오기">
                    <FolderOpenIcon className="h-4 w-4" />
                    불러오기
                </button>
                 <button onClick={handleSaveComponentInfo} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-white transition-colors" title="컴포넌트 정보 저장">
                    <CodeBracketIcon className="h-4 w-4" />
                    컴포넌트 JSON
                </button>
                <button onClick={handleSaveDesignSpec} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-white transition-colors" title="디자인 명세 저장">
                    <DocumentTextIcon className="h-4 w-4" />
                    디자인 명세 JSON
                </button>
                 <button onClick={handleSaveAsImage} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md font-semibold transition-colors">
                    <SaveIcon className="h-4 w-4" />
                    이미지로 저장
                </button>
                 <button onClick={() => setIsHelpModalOpen(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="도움말 및 사용법">
                    <QuestionMarkCircleIcon className="w-5 h-5" />
                </button>
            </div>
        </header>
        <div className="flex flex-grow min-h-0">
            <LeftSidebar
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                components={components}
                selectedComponentIds={selectedComponentIds}
                onSelect={(id) => setSelectedComponentIds([id])}
                onMoveLayer={moveComponentLayer}
                onDelete={deleteComponent}
              />
            <main
                ref={mainRef}
                className={`flex-grow canvas-bg relative ${activeTool ? 'cursor-crosshair' : 'cursor-default'}`}
            >
                <div
                  ref={canvasRef}
                  className="w-full h-full relative"
                  onMouseDown={handleCanvasMouseDown}
                >
                    <Canvas 
                      components={components} 
                      selectedComponentIds={selectedComponentIds}
                      setSelectedComponentIds={setSelectedComponentIds}
                      updateComponentPosition={updateComponentPosition}
                      updateComponentSize={updateComponentSize}
                      updateComponentProps={updateComponentProps}
                      onContextMenuOpen={handleOpenContextMenu}
                      activeTool={activeTool}
                    />
                    {drawingState && (
                        <div
                            className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 pointer-events-none"
                            style={{
                                left: Math.min(drawingState.start.x, drawingState.end.x),
                                top: Math.min(drawingState.start.y, drawingState.end.y),
                                width: Math.abs(drawingState.start.x - drawingState.end.x),
                                height: Math.abs(drawingState.start.y - drawingState.end.y),
                            }}
                        />
                    )}
                    {marqueeState && (
                        <div
                            className="absolute border border-blue-400 bg-blue-400/20 pointer-events-none"
                            style={{
                                left: Math.min(marqueeState.start.x, marqueeState.end.x),
                                top: Math.min(marqueeState.start.y, marqueeState.end.y),
                                width: Math.abs(marqueeState.start.x - marqueeState.end.x),
                                height: Math.abs(marqueeState.start.y - marqueeState.end.y),
                            }}
                        />
                    )}
                </div>
                 {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        component={contextMenu.component}
                        onClose={handleCloseContextMenu}
                        onDuplicate={() => duplicateComponent(contextMenu.component.id)}
                        onDelete={() => deleteComponent(contextMenu.component.id)}
                        onMoveLayer={(direction) => moveComponentLayer(contextMenu.component.id, direction)}
                        onToggleLock={() => handleToggleLock(contextMenu.component.id)}
                        canGroup={selectedComponentIds.length > 1}
                        onGroup={handleGroup}
                        canUngroup={!!lastSelectedComponent && lastSelectedComponent.type === ComponentType.Group}
                        onUngroup={handleUngroup}
                    />
                )}
            </main>
            <PropertiesPanel 
                component={selectedComponent}
                appName={appName}
                setAppName={setAppName}
                appDescription={appDescription}
                setAppDescription={setAppDescription}
                screenDescription={screenDescription}
                setScreenDescription={setScreenDescription}
                handleGetAISuggestions={handleGetAISuggestions}
                isAiLoading={isAiLoading}
                updateComponentProps={updateComponentProps}
                updateComponentSize={updateComponentSize}
                updateComponentStyles={updateComponentStyles}
                updateComponentDescription={updateComponentDescription}
                updateComponentName={updateComponentName}
                applyComponentPreset={applyComponentPreset}
                deleteComponent={selectedComponent ? () => deleteComponent(selectedComponent.id) : () => {}}
                duplicateComponent={selectedComponent ? () => duplicateComponent(selectedComponent.id) : () => {}}
            />
        </div>
    </div>
  );
};

export default App;