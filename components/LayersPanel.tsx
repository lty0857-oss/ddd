import React, { useState } from 'react';
import { CanvasComponent, ComponentType } from '../types';
import { ChevronUpIcon, ChevronDownIcon, ChevronsUpIcon, ChevronsDownIcon, TrashIcon, ChevronRightIcon, Bars3Icon } from './icons';

interface LayersPanelProps {
    components: CanvasComponent[];
    selectedComponentIds: string[];
    onSelect: (id: string) => void;
    onMoveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
    onDelete: (id: string) => void;
}

const LayerItem: React.FC<{
    component: CanvasComponent;
    allComponents: CanvasComponent[];
    level: number;
    selectedComponentIds: string[];
    onSelect: (id: string) => void;
}> = ({ component, allComponents, level, selectedComponentIds, onSelect }) => {
    const isSelected = selectedComponentIds.includes(component.id);
    const children = allComponents.filter(c => c.parentId === component.id);
    const [isExpanded, setIsExpanded] = useState(true);

    const isGroup = component.type === ComponentType.Group;

    return (
        <>
            <div
                onClick={() => onSelect(component.id)}
                className={`flex items-center px-4 py-2 text-sm cursor-pointer truncate ${isSelected ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                style={{ paddingLeft: `${1 + level * 1.5}rem` }}
            >
                {isGroup && (
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className={`mr-1 p-0.5 rounded hover:bg-white/10 ${isExpanded ? '' : '-ml-1'}`}>
                        {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-4 h-4" />}
                    </button>
                )}
                <span className="truncate">{component.name}</span>
            </div>
            {isGroup && isExpanded && (
                <div>
                    {[...children].reverse().map(child => (
                        <LayerItem key={child.id} component={child} allComponents={allComponents} level={level + 1} selectedComponentIds={selectedComponentIds} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </>
    );
};


export const LayersPanel: React.FC<LayersPanelProps> = ({ components, selectedComponentIds, onSelect, onMoveLayer, onDelete }) => {
    const topLevelComponents = components.filter(c => !c.parentId);
    const selectedId = selectedComponentIds.length === 1 ? selectedComponentIds[0] : null;
    const selectedComponent = selectedId ? components.find(c => c.id === selectedId) : null;
    const canMove = selectedComponent && !selectedComponent.parentId;
    const selectedIndex = selectedComponent ? topLevelComponents.findIndex(c => c.id === selectedId) : -1;

    return (
        <div className="flex flex-col flex-grow min-h-0">
            <div className="flex-grow overflow-y-auto panel-scrollbar">
                {components.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-500">레이어가 없습니다.</div>
                ) : (
                    [...topLevelComponents].reverse().map((component) => (
                        <LayerItem
                            key={component.id}
                            component={component}
                            allComponents={components}
                            level={0}
                            selectedComponentIds={selectedComponentIds}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </div>
            <div className="p-2 border-t border-gray-700 flex justify-around flex-shrink-0">
                <button onClick={() => onMoveLayer(selectedId!, 'top')} disabled={!canMove || selectedIndex === topLevelComponents.length - 1} className="p-2 disabled:text-gray-600 hover:text-white" title="맨 앞으로"><ChevronsUpIcon className="w-5 h-5" /></button>
                <button onClick={() => onMoveLayer(selectedId!, 'up')} disabled={!canMove || selectedIndex === topLevelComponents.length - 1} className="p-2 disabled:text-gray-600 hover:text-white" title="앞으로"><ChevronUpIcon className="w-5 h-5" /></button>
                <button onClick={() => onMoveLayer(selectedId!, 'down')} disabled={!canMove || selectedIndex === 0} className="p-2 disabled:text-gray-600 hover:text-white" title="뒤로"><ChevronDownIcon className="w-5 h-5" /></button>
                <button onClick={() => onMoveLayer(selectedId!, 'bottom')} disabled={!canMove || selectedIndex === 0} className="p-2 disabled:text-gray-600 hover:text-white" title="맨 뒤로"><ChevronsDownIcon className="w-5 h-5" /></button>
                <button onClick={() => selectedId && onDelete(selectedId)} disabled={!selectedId} className="p-2 disabled:text-gray-600 hover:text-red-400" title="레이어 삭제"><TrashIcon className="w-5 h-5" /></button>
            </div>
        </div>
    );
};