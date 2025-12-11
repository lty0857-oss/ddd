import React, { useState, MouseEvent, useEffect, useRef } from 'react';
import { CanvasComponent, ComponentType } from '../types';
import { ICONS_MAP } from '../constants';
import { CheckCircleIcon, ExclamationTriangleIcon, ImageIcon, InformationCircleIcon, LockClosedIcon, XCircleIcon, XMarkIcon } from './icons';

interface ComponentRendererProps {
  component: CanvasComponent;
  allComponents: CanvasComponent[];
  isSelected: boolean;
  selectedComponentIds: string[];
  onSelect: (id: string, shiftKey: boolean) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  onPropsChange: (id: string, newProps: Record<string, any>) => void;
  onContextMenuOpen: (e: React.MouseEvent, component: CanvasComponent) => void;
  activeTool: ComponentType | null;
}

const getTopLevelParentId = (id: string, components: CanvasComponent[]): string => {
    const comp = components.find(c => c.id === id);
    if (comp?.parentId) {
        return getTopLevelParentId(comp.parentId, components);
    }
    return id;
};

export const ComponentRenderer: React.FC<ComponentRendererProps> = ({ component, allComponents, isSelected, selectedComponentIds, onSelect, onPositionChange, onSizeChange, onPropsChange, onContextMenuOpen, activeTool }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const textRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    if (isEditing || (component.type === ComponentType.Container && component.isLocked)) {
      return;
    }
    
    const topLevelParentId = getTopLevelParentId(component.id, allComponents);
    onSelect(topLevelParentId, e.shiftKey);
    
    const topLevelParent = allComponents.find(c => c.id === topLevelParentId)!;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - topLevelParent.position.x,
      y: e.clientY - topLevelParent.position.y,
    };
  };
  
  const handleResizeMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: component.size.width,
        height: component.size.height,
    }
  };
  
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const topLevelParentId = getTopLevelParentId(component.id, allComponents);
    const topLevelComponent = allComponents.find(c => c.id === topLevelParentId);
    if (topLevelComponent) {
      onSelect(topLevelParentId, e.shiftKey);
      onContextMenuOpen(e, topLevelComponent);
    }
  };

  const handleDoubleClick = () => {
    if (component.type === ComponentType.Text) {
      setIsEditing(true);
    }
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    if (textRef.current) {
        onPropsChange(component.id, { text: textRef.current.innerText });
    }
  };

  useEffect(() => {
    if (isEditing && textRef.current) {
        textRef.current.focus();
        document.execCommand('selectAll', false, undefined);
    }
  }, [isEditing]);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isDragging) {
        const topLevelParentId = getTopLevelParentId(component.id, allComponents);
        onPositionChange(topLevelParentId, {
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      }
      if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        
        let newWidth = resizeStartRef.current.width + dx;
        let newHeight = resizeStartRef.current.height + dy;
        
        if (newWidth < 10) newWidth = 10;
        if (newHeight < 10) newHeight = 10;

        onSizeChange(component.id, { width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      if(isDragging) {
        // Finalize position update for history
        const topLevelParentId = getTopLevelParentId(component.id, allComponents);
        const topLevelParent = allComponents.find(c => c.id === topLevelParentId)!;
        onPositionChange(topLevelParentId, { ...topLevelParent.position });
      }
      if (isResizing) {
        onSizeChange(component.id, { ...component.size });
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, component, allComponents, onPositionChange, onSizeChange]);


  const { position, size, styles, description, isLocked } = component;
  const isChildOfSelectedGroup = () => {
    if (!component.parentId) return false;
    let currentParentId: string | undefined = component.parentId;
    while(currentParentId) {
        if (selectedComponentIds.includes(currentParentId)) return true;
        const parent = allComponents.find(c => c.id === currentParentId);
        currentParentId = parent?.parentId;
    }
    return false;
  }
  
  const wrapperClasses = `absolute ${!isEditing && !isLocked ? 'cursor-move' : (isLocked ? 'cursor-default' : '')} ${isSelected && !isLocked ? 'ring-2 ring-blue-500' : isChildOfSelectedGroup() ? 'ring-1 ring-blue-400/70 ring-dashed' : ''}`;
  
  const componentStyle: React.CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    userSelect: isDragging || isResizing ? 'none' : 'auto',
    pointerEvents: isLocked && component.type === ComponentType.Container && activeTool ? 'none' : 'auto',
  };

  const renderComponent = () => {
    const { type, props } = component;
    const innerStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...styles,
        borderStyle: styles.borderStyle || 'solid',
    };
    
    switch (type) {
      case ComponentType.Button: {
        const { kind = 'text', icon, text } = props;
        const Icon = icon && ICONS_MAP[icon];
        const showIcon = (kind === 'icon' || kind === 'text-icon') && Icon;
        const showText = (kind === 'text' || kind === 'text-icon') && text && text.trim().length > 0;

        return (
          <button style={{ ...innerStyle, gap: showText && showIcon ? '0.5rem' : '0' }}>
            {showIcon && <Icon className={showText ? 'h-5 w-5 flex-shrink-0' : 'h-2/3 w-2/3'} />}
            {showText && <span>{text}</span>}
          </button>
        );
      }
      
      case ComponentType.Text:
        return <div 
            ref={textRef}
            style={{...innerStyle, cursor: isEditing ? 'text' : 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word', alignItems: 'flex-start', justifyContent: 'flex-start'}} 
            onBlur={handleTextBlur}
            contentEditable={isEditing}
            suppressContentEditableWarning
        >
          {props.text}
        </div>
      
      case ComponentType.Container:
        return <div style={innerStyle} />;

      case ComponentType.Group:
        const children = allComponents.filter(c => c.parentId === component.id);
        return (
            <div style={innerStyle} className="pointer-events-none">
                 {children.map(child => (
                    <ComponentRenderer
                        key={child.id}
                        component={child}
                        allComponents={allComponents}
                        isSelected={selectedComponentIds.includes(child.id)}
                        selectedComponentIds={selectedComponentIds}
                        onSelect={onSelect}
                        onPositionChange={onPositionChange}
                        onSizeChange={onSizeChange}
                        onPropsChange={onPropsChange}
                        onContextMenuOpen={onContextMenuOpen}
                        activeTool={activeTool}
                    />
                ))}
            </div>
        );

      case ComponentType.Image:
        return (
          <div 
            style={{
              ...innerStyle, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              backgroundColor: styles.backgroundColor || '#2d3748',
              border: styles.borderWidth > 0 ? `${styles.borderWidth}px solid ${styles.borderColor}` : '2px dashed #4a5568',
            }}
          >
            <ImageIcon className="h-1/3 w-1/3 text-gray-500" />
          </div>
        );

      case ComponentType.Input:
        return <input type="text" placeholder={props.placeholder} style={{...innerStyle, paddingLeft: styles.paddingLeft || 8}} readOnly />;
      
      case ComponentType.Listbox: {
        const items = props.items || [];
        const selectedIndex = props.selectedIndex;
        return (
            <div style={{...innerStyle, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', overflow: 'hidden', padding: '4px'}}>
                <ul className="w-full h-full overflow-y-auto space-y-1 panel-scrollbar">
                    {items.map((item: string, index: number) => (
                        <li
                            key={index}
                            className={`px-3 py-1.5 text-sm rounded-md truncate cursor-default ${
                                index === selectedIndex
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-200 hover:bg-gray-600'
                            }`}
                        >
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
        );
      }

      case ComponentType.Tabs:
        const tabs = props.tabs || [];
        const activeTab = props.activeTab;
        const tabStyle = props.style || 'line';

        if (tabStyle === 'pill') {
          return (
            <div className="flex w-full h-full items-center justify-center p-1 gap-1" style={{backgroundColor: styles.backgroundColor, borderRadius: styles.borderRadius}}>
              {tabs.map((tab: string, index: number) => (
                <button key={index} className={`px-4 py-1.5 text-sm font-medium flex-grow h-full rounded-md transition-colors ${index === activeTab ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                  {tab}
                </button>
              ))}
            </div>
          );
        }

        if (tabStyle === 'segmented') {
          return (
            <div className="flex w-full h-full items-center p-1 bg-gray-700 rounded-lg">
              {tabs.map((tab: string, index: number) => (
                <button key={index} className={`px-4 py-1.5 text-sm font-medium flex-grow h-full rounded-md transition-colors ${index === activeTab ? 'bg-gray-900 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}>
                  {tab}
                </button>
              ))}
            </div>
          );
        }
        
        // Default to 'line' style
        return (
          <div className="flex w-full h-full border-b border-gray-600">
            {tabs.map((tab: string, index: number) => (
              <button key={index} className={`px-4 h-full text-sm font-medium flex-grow transition-colors ${index === activeTab ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}>
                {tab}
              </button>
            ))}
          </div>
        );
      
      case ComponentType.Accordion:
        const accordionItemStyle: React.CSSProperties = {
          width: '100%',
          overflow: 'hidden',
          borderStyle: 'solid',
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
          borderWidth: styles.borderWidth,
          borderRadius: styles.borderRadius,
          color: styles.color,
        };
        return (
          <div className="w-full h-full space-y-2 overflow-y-auto p-1">
            {(props.items || []).map((item: { title: string, content: string }, index: number) => (
              <div key={index} style={accordionItemStyle}>
                <button
                  className="w-full flex justify-between items-center p-3 text-left font-medium text-white hover:bg-gray-700/50 focus:outline-none"
                  onClick={() => onPropsChange(component.id, { openItem: props.openItem === index ? null : index })}
                >
                  <span>{item.title}</span>
                  <svg className={`w-5 h-5 transition-transform ${props.openItem === index ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {props.openItem === index && (
                  <div className="p-3 border-t text-sm text-gray-300" style={{ borderColor: styles.borderColor || '#374151' }}>
                    {item.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case ComponentType.Dropdown:
        const isOpen = props.isOpen || false;
        return (
            <div className="relative w-full h-full" style={{...styles, borderStyle: 'solid'}}>
                <button type="button" style={{width: '100%', height: '100%', backgroundColor: 'transparent'}} className="inline-flex justify-between items-center px-4 py-2">
                  <span>{(props.options || [])[0] || '선택...'}</span>
                  <svg className={`-mr-1 ml-2 h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
                {isOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-md bg-gray-700 shadow-lg border border-gray-600">
                        <div className="py-1" role="menu" aria-orientation="vertical">
                            {(props.options || []).map((option: string, index: number) => (
                                <a href="#" key={index} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600" role="menuitem">{option}</a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );

      case ComponentType.Radio:
        const isRadioChecked = props.checked || false;
        return (
          <div style={{...innerStyle, justifyContent: 'flex-start', gap: '8px'}} className="px-2">
            <div className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center flex-shrink-0">
              {isRadioChecked && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
            </div>
            <span className="truncate">{props.label}</span>
          </div>
        );

      case ComponentType.Checkbox:
        const isCheckboxChecked = props.checked || false;
        return (
          <div style={{...innerStyle, justifyContent: 'flex-start', gap: '8px'}} className="px-2">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isCheckboxChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
              {isCheckboxChecked && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="truncate">{props.label}</span>
          </div>
        );

      case ComponentType.Toggle:
        const isOn = props.isOn || false;
        const { leftLabel, rightLabel } = props;
        return (
          <div style={{ ...innerStyle, justifyContent: 'center', gap: '8px', padding: '0 8px' }}>
              {leftLabel && <span className="text-sm text-gray-300 truncate">{leftLabel}</span>}
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-default rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOn ? 'bg-blue-600' : 'bg-gray-600'
                }`}
                role="switch"
                aria-checked={isOn}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              {rightLabel && <span className="text-sm text-gray-300 truncate">{rightLabel}</span>}
          </div>
        );
      
      case ComponentType.Slider:
        const value = props.value || 0;
        const progress = Math.max(0, Math.min(100, value));
        return (
          <div style={innerStyle} className="px-2">
            <div className="relative w-full">
              <div className="h-1.5 bg-gray-600 rounded-full w-full"></div>
              <div className="absolute top-0 h-1.5 bg-blue-500 rounded-full" style={{ width: `${progress}%` }}></div>
              <div className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-white rounded-full shadow border border-gray-300 cursor-pointer" style={{ left: `calc(${progress}% - 8px)` }}></div>
            </div>
          </div>
        );
      
      case ComponentType.Alert:
        const alertType = props.type || 'info';
        const alertStylesMapping = {
          info: { icon: <InformationCircleIcon className="h-5 w-5 text-blue-400" />, defaultStyles: { backgroundColor: 'rgba(30, 58, 138, 0.5)', borderColor: '#3b82f6', color: '#93c5fd', borderLeftWidth: 4, borderWidth: 0 } },
          success: { icon: <CheckCircleIcon className="h-5 w-5 text-green-400" />, defaultStyles: { backgroundColor: 'rgba(21, 128, 61, 0.5)', borderColor: '#22c55e', color: '#86efac', borderLeftWidth: 4, borderWidth: 0 } },
          warning: { icon: <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />, defaultStyles: { backgroundColor: 'rgba(217, 119, 6, 0.5)', borderColor: '#f59e0b', color: '#fcd34d', borderLeftWidth: 4, borderWidth: 0 } },
          error: { icon: <XCircleIcon className="h-5 w-5 text-red-400" />, defaultStyles: { backgroundColor: 'rgba(153, 27, 27, 0.5)', borderColor: '#ef4444', color: '#fca5a5', borderLeftWidth: 4, borderWidth: 0 } },
        };
        const alertInfo = alertStylesMapping[alertType as keyof typeof alertStylesMapping] || alertStylesMapping.info;
        
        const finalAlertStyle: React.CSSProperties = {
            ...alertInfo.defaultStyles,
            ...styles,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '1rem',
            borderStyle: 'solid',
            justifyContent: 'space-between'
        };

        return (
          <div style={finalAlertStyle} className="relative">
            <div className="flex items-center">
                <div className="flex-shrink-0">{alertInfo.icon}</div>
                <div className={`ml-3 text-sm font-medium`} style={{ color: finalAlertStyle.color }}>{props.text}</div>
            </div>
            {props.dismissible && (
              <button className="p-1 text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        );

      case ComponentType.Loader:
        const loaderStyle = props.style || 'spinner';
        if (loaderStyle === 'dots') {
            return (
                <div style={innerStyle} className="flex gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                </div>
            );
        }
        return (
            <div style={{...innerStyle, backgroundColor: 'transparent'}}>
                <svg className="animate-spin h-full w-full text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
            </div>
        );

      case ComponentType.Progress:
        return (
          <div className="relative w-full rounded-full h-full overflow-hidden" style={{backgroundColor: styles.backgroundColor}}>
            <div className="h-full rounded-full" style={{width: `${props.progress}%`, backgroundColor: styles.barColor, backgroundImage: styles.backgroundImage, transition: 'width 0.3s ease'}}></div>
            {props.showLabel && (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                {props.progress}%
              </div>
            )}
          </div>
        );
      
      case ComponentType.Tooltip:
          return (
            <div className="relative group w-full h-full flex items-center justify-center">
                <InformationCircleIcon className="w-6 h-6 text-gray-400" />
                <div className="absolute bottom-full mb-2 w-max px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                    {props.text}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
            </div>
          );

      case ComponentType.Modal:
        return (
            <div style={{...innerStyle, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between'}}>
              <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                  <h3 className="text-lg font-semibold">{props.title}</h3>
                  <button className="text-gray-400 hover:text-white">&times;</button>
              </div>
              <div className="p-4 flex-grow">{props.content}</div>
              <div className="flex justify-end p-4 border-t border-gray-700 gap-2 flex-shrink-0">
                  <button className="px-4 py-2 text-sm bg-gray-600 rounded hover:bg-gray-500">취소</button>
                  <button className="px-4 py-2 text-sm bg-blue-600 rounded hover:bg-blue-500">확인</button>
              </div>
            </div>
        );

      case ComponentType.Popover:
          const placement = props.placement || 'bottom';
          const beakClasses: {[key: string]: string} = {
              top: 'absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-x-8 border-x-transparent border-t-8',
              bottom: 'absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-x-8 border-x-transparent border-b-8',
              left: 'absolute top-1/2 -translate-y-1/2 -right-2 w-0 h-0 border-y-8 border-y-transparent border-l-8',
              right: 'absolute top-1/2 -translate-y-1/2 -left-2 w-0 h-0 border-y-8 border-y-transparent border-r-8',
          };
          
          const beakStyle: React.CSSProperties = {};
          const color = styles.backgroundColor || '#374151';
          if (placement === 'top') beakStyle.borderTopColor = color;
          if (placement === 'bottom') beakStyle.borderBottomColor = color;
          if (placement === 'left') beakStyle.borderLeftColor = color;
          if (placement === 'right') beakStyle.borderRightColor = color;

          return (
            <div style={{...innerStyle, position: 'relative'}}>
                <div style={{...innerStyle, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', overflow: 'hidden'}}>
                    <div className="p-3 border-b border-gray-600">
                      <h3 className="font-semibold">{props.title}</h3>
                    </div>
                    <div className="p-3 text-sm flex-grow">
                        팝오버 컨텐츠가 여기에 표시됩니다.
                    </div>
                </div>
                <div style={beakStyle} className={beakClasses[placement]}></div>
            </div>
          );

      case ComponentType.Icon:
        const IconComponent = ICONS_MAP[props.icon] || ICONS_MAP.HomeIcon;
        return <IconComponent style={{ width: '100%', height: '100%', color: styles.color }} />;
      
      case ComponentType.BarChart:
      case ComponentType.LineChart:
      case ComponentType.PieChart: {
        const chartContainerStyle: React.CSSProperties = {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...styles,
            borderStyle: 'solid',
            padding: '1rem',
            color: '#9ca3af',
        };

        if (type === ComponentType.BarChart) {
            const data = props.data || [];
            return (
                <div style={chartContainerStyle} className="items-end gap-2">
                    {data.map((item: {value1: number}, i: number) => (
                        <div key={i} className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${item.value1}%`, backgroundColor: props.colors[i % props.colors.length] || '#8884d8' }} />
                    ))}
                </div>
            );
        }
        if (type === ComponentType.LineChart) {
            const data = props.data || [];
            const points = data.map((p: {value1: number}, i: number) => `${(i / (data.length -1)) * 100} ${100 - p.value1}`).join(' L ');
            const points2 = data.map((p: {value2: number}, i: number) => `${(i / (data.length -1)) * 100} ${100 - p.value2}`).join(' L ');
            return (
                <div style={chartContainerStyle}>
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d={`M ${points}`} fill="none" stroke={props.colors[0] || '#8884d8'} strokeWidth="2" />
                        <path d={`M ${points2}`} fill="none" stroke={props.colors[1] || '#82ca9d'} strokeWidth="2" />
                    </svg>
                </div>
            );
        }
        if (type === ComponentType.PieChart) {
             const data = props.data || [];
             const total = data.reduce((acc: number, item: {value1: number}) => acc + item.value1, 0);
             let cumulative = 0;
             const gradientColors = (props.colors || []).map((color: string, i: number) => {
                if (!data[i]) return '';
                const start = (cumulative / total) * 100;
                cumulative += data[i].value1;
                const end = (cumulative / total) * 100;
                return `${color} ${start}% ${end}%`;
            }).filter(Boolean).join(', ');

            return (
                 <div style={chartContainerStyle}>
                    <div 
                        className="w-full h-full rounded-full"
                        style={{
                            width: Math.min(size.width, size.height) * 0.8,
                            height: Math.min(size.width, size.height) * 0.8,
                            background: `conic-gradient(${gradientColors})`
                        }}
                    />
                </div>
            );
        }
        return null;
      }
      
      case ComponentType.Misc:
        return (
            <div style={{...innerStyle, padding: '8px', textAlign: 'center', wordBreak: 'break-word'}}>
                {description || '설명을 입력하세요...'}
            </div>
        );

      default:
        return <div className="text-red-500">Unknown Component</div>;
    }
  };

  return (
    <div
      style={componentStyle}
      className={wrapperClasses}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
        {isLocked && component.type === ComponentType.Container && (
            <div className="absolute top-1 right-1 z-20 p-0.5 bg-gray-900/50 rounded-full">
                <LockClosedIcon className="w-3 h-3 text-yellow-300" />
            </div>
        )}
        {renderComponent()}
      {isSelected && !isLocked && !component.parentId && (
        <>
          {description && (
            <div className="absolute -top-3 -right-3 group z-20">
              <InformationCircleIcon className="w-5 h-5 text-blue-400 bg-gray-800 rounded-full cursor-pointer" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 pointer-events-none">
                  {description}
              </div>
            </div>
          )}
          <div
              className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-10"
              onMouseDown={handleResizeMouseDown}
          />
        </>
      )}
    </div>
  );
};