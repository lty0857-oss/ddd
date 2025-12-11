import React from 'react';
import { TOOLBOX_COMPONENTS, TOOLTIP_DESCRIPTIONS } from '../constants';
import { ComponentType } from '../types';
import { YoutubeIcon } from './icons';

interface ToolboxProps {
    activeTool: ComponentType | null;
    setActiveTool: (tool: ComponentType | null) => void;
}

export const Toolbox: React.FC<ToolboxProps> = ({ activeTool, setActiveTool }) => {

  const handleToolSelect = (type: ComponentType) => {
    setActiveTool(activeTool === type ? null : type);
  };

  return (
    <div className="flex flex-col flex-grow">
      <div className="p-1 overflow-y-auto overflow-x-hidden panel-scrollbar flex-grow">
        <div className="grid grid-cols-3 gap-1">
          {TOOLBOX_COMPONENTS.map(({ type, name, icon: Icon }) => (
            <div key={type} className="relative group">
              <div
                onClick={() => handleToolSelect(type)}
                className={`flex flex-col items-center justify-center p-1 rounded-lg cursor-pointer transition-all duration-150 transform aspect-square ${
                    activeTool === type ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-gray-800 hover:bg-gray-700 hover:text-blue-400'
                }`}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span className="text-xs text-center leading-tight">{name}</span>
              </div>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-64 p-2 bg-gray-800 border border-gray-600 rounded-lg text-xs text-gray-300 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 pointer-events-none z-20">
                <p className="font-bold mb-1">{name}</p>
                <p>{TOOLTIP_DESCRIPTIONS[type]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-2 border-t border-gray-700 flex-shrink-0">
          <p className="text-sm text-gray-400 text-center mb-2">개발자 GPT PARK</p>
          <a 
            href="https://www.youtube.com/@AIFACT-GPTPARK" 
            target="_blank" 
            rel="noopener noreferrer"
            title="유튜브 바로가기"
            className="mx-auto flex items-center justify-center w-6 h-6 bg-red-600 hover:bg-red-500 rounded-md text-white transition-colors"
          >
              <YoutubeIcon className="w-5 h-5" />
          </a>
      </div>
    </div>
  );
};