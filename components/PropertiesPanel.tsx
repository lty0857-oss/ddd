import React, { useState, useEffect } from 'react';
import { CanvasComponent, ComponentType, Preset } from '../types';
import { ICONS_MAP, COMPONENT_PRESETS } from '../constants';
import { DuplicateIcon, TrashIcon, SparklesIcon, DocumentTextIcon, CogIcon } from './icons';

interface PropertiesPanelProps {
  component: CanvasComponent | null;
  appName: string;
  setAppName: (name: string) => void;
  appDescription: string;
  setAppDescription: (desc: string) => void;
  screenDescription: string;
  setScreenDescription: (desc: string) => void;
  handleGetAISuggestions: () => Promise<void>;
  isAiLoading: boolean;
  updateComponentProps: (id: string, newProps: Record<string, any>) => void;
  updateComponentSize: (id: string, newSize: { width: number; height: number }) => void;
  updateComponentStyles: (id: string, newStyles: Record<string, any>) => void;
  updateComponentDescription: (id: string, description: string) => void;
  updateComponentName: (id: string, name: string) => void;
  applyComponentPreset: (id: string, preset: Preset) => void;
  deleteComponent: () => void;
  duplicateComponent: () => void;
}

const PropertyGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
        <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">{title}</h4>
        <div className="bg-gray-800 p-3 rounded-lg">{children}</div>
    </div>
);

const PropertyInput: React.FC<{ label: string; value: any; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void; type?: string, as?: 'input' | 'textarea', readOnly?: boolean }> = ({ label, value, onChange, type = "text", as = 'input', readOnly = false }) => (
    <div className="mb-3 last:mb-0">
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        {as === 'textarea' ? (
          <textarea value={value} onChange={onChange} rows={3} readOnly={readOnly} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
        ) : (
          <input type={type} value={value} onChange={onChange} readOnly={readOnly} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        )}
    </div>
);

const PropertySelect: React.FC<{ label: string; value: any; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: {value: string, label: string}[] }> = ({ label, value, onChange, options }) => (
    <div className="mb-3 last:mb-0">
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <select value={value} onChange={onChange} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

const PropertyColor: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
    <div className="mb-3 last:mb-0">
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <div className="flex items-center gap-2">
            <input 
                type="color" 
                value={value || '#000000'} 
                onChange={(e) => onChange(e.target.value)} 
                className="p-0 border-none rounded bg-transparent cursor-pointer"
                style={{width: '28px', height: '28px'}}
             />
            <input 
                type="text" 
                value={value || ''} 
                onChange={(e) => onChange(e.target.value)} 
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm" 
                placeholder="#RRGGBB" 
            />
        </div>
    </div>
);


export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ component, appName, setAppName, appDescription, setAppDescription, screenDescription, setScreenDescription, handleGetAISuggestions, isAiLoading, updateComponentProps, updateComponentSize, updateComponentStyles, updateComponentDescription, updateComponentName, applyComponentPreset, deleteComponent, duplicateComponent }) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'spec'>('spec');

  useEffect(() => {
    if (component) {
      setActiveTab('properties');
    } else {
      setActiveTab('spec');
    }
  }, [component]);

  const handlePropChange = (propName: string, value: any) => {
    if (!component) return;
    updateComponentProps(component.id, { [propName]: value });
  };
  
  const handleStyleChange = (styleName: string, value: any) => {
    if (!component) return;
    updateComponentStyles(component.id, { [styleName]: value });
  };
  
  const handleDescriptionChange = (value: string) => {
    if (!component) return;
    updateComponentDescription(component.id, value);
  };
  
  const handleNameChange = (value: string) => {
    if (!component) return;
    updateComponentName(component.id, value);
  };

  const handleSizeChange = (dimension: 'width' | 'height', value: number) => {
    if (!component) return;
    const newSize = { ...component.size, [dimension]: value >= 1 ? value : 1 };
    updateComponentSize(component.id, newSize);
  };

  const renderComponentSpecificProps = () => {
    if (!component) return null;
    const { type, props } = component;
    switch (type) {
      case ComponentType.Text:
        return <PropertyInput as="textarea" label="텍스트" value={props.text} onChange={e => handlePropChange('text', e.target.value)} />;
      case ComponentType.Button: {
          const buttonPresets = COMPONENT_PRESETS[ComponentType.Button] || [];
          const functionalPresets = buttonPresets.filter(p => p.type === 'functional');

          const { kind = 'text', icon } = props;
          
          let currentPurpose = 'Custom';
          const standardPreset = functionalPresets.find(p => p.name === 'Standard');
          if (standardPreset && kind === standardPreset.props?.kind && !icon) {
              currentPurpose = 'Standard';
          } else {
              for (const preset of functionalPresets) {
                  if (preset.name !== 'Standard' && preset.props?.kind === kind && preset.props?.icon === icon) {
                      currentPurpose = preset.name;
                      break;
                  }
              }
          }

          const handlePurposeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
              const presetName = e.target.value;
              const preset = functionalPresets.find(p => p.name === presetName);
              if (preset) {
                  applyComponentPreset(component.id, preset);
              }
          };

          return (
            <>
                <PropertyGroup title="용도">
                    <PropertySelect
                        label="버튼 용도"
                        value={currentPurpose}
                        onChange={handlePurposeChange}
                        options={[...functionalPresets.map(p => ({ value: p.name, label: p.name })), ...(currentPurpose === 'Custom' ? [{ value: 'Custom', label: '사용자 정의' }] : [])]}
                    />
                </PropertyGroup>
                <PropertyGroup title="세부 속성">
                    <PropertySelect label="종류" value={props.kind || 'text'} onChange={e => handlePropChange('kind', e.target.value)} options={[
                        { value: 'text', label: '텍스트만' },
                        { value: 'icon', label: '아이콘만' },
                        { value: 'text-icon', label: '텍스트와 아이콘' }
                    ]} />
                    {(props.kind === 'icon' || props.kind === 'text-icon') && (
                        <PropertySelect label="아이콘" value={props.icon} onChange={e => handlePropChange('icon', e.target.value)} options={Object.keys(ICONS_MAP).map(name => ({value: name, label: name}))} />
                    )}
                    {(props.kind === 'text' || props.kind === 'text-icon') && (
                        <PropertyInput as="textarea" label="텍스트" value={props.text} onChange={e => handlePropChange('text', e.target.value)} />
                    )}
                </PropertyGroup>
            </>
          );
      }
      case ComponentType.Input:
        return <PropertyInput label="Placeholder" value={props.placeholder} onChange={e => handlePropChange('placeholder', e.target.value)} />;
      case ComponentType.Image:
        return <PropertyInput as="textarea" label="이미지 URL" value={props.src} onChange={e => handlePropChange('src', e.target.value)} />;
      case ComponentType.Listbox: {
        const items: string[] = props.items || [];
        const handleItemChange = (index: number, value: string) => {
            const newItems = [...items];
            newItems[index] = value;
            handlePropChange('items', newItems);
        };
        const addItem = () => {
            handlePropChange('items', [...items, `항목 ${items.length + 1}`]);
        };
        const removeItem = (index: number) => {
            const newItems = items.filter((_, i) => i !== index);
            handlePropChange('items', newItems);
            if(props.selectedIndex >= newItems.length) {
                handlePropChange('selectedIndex', Math.max(0, newItems.length - 1));
            }
        };
        return (
            <div className="space-y-2">
                <label className="block text-xs text-gray-400 mb-1">항목</label>
                {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input type="text" value={item} onChange={e => handleItemChange(index, e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm" />
                        <button onClick={() => removeItem(index)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={addItem} className="w-full mt-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">항목 추가</button>
            </div>
        );
      }
      case ComponentType.Dropdown: {
        const options: string[] = props.options || [];
        const handleOptionChange = (index: number, value: string) => {
            const newOptions = [...options];
            newOptions[index] = value;
            handlePropChange('options', newOptions);
        };
        const addOption = () => {
            handlePropChange('options', [...options, `옵션 ${options.length + 1}`]);
        };
        const removeOption = (index: number) => {
            handlePropChange('options', options.filter((_, i) => i !== index));
        };
        return (
            <div className="space-y-2">
                <label className="block text-xs text-gray-400 mb-1">옵션</label>
                {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input type="text" value={option} onChange={e => handleOptionChange(index, e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm" />
                        <button onClick={() => removeOption(index)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                ))}
                <button onClick={addOption} className="w-full mt-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">옵션 추가</button>
            </div>
        );
      }
      case ComponentType.Alert:
        return <>
            <PropertyInput label="텍스트" value={props.text} onChange={e => handlePropChange('text', e.target.value)} />
            <PropertySelect label="타입" value={props.type} onChange={e => handlePropChange('type', e.target.value)} options={[
                {value: 'info', label: '정보'}, {value: 'success', label: '성공'}, {value: 'warning', label: '경고'}, {value: 'error', 'label': '오류'}
            ]} />
             <div className="flex items-center justify-between mt-3">
              <label className="text-sm text-gray-300">닫기 버튼 표시</label>
              <input type="checkbox" checked={props.dismissible || false} onChange={e => handlePropChange('dismissible', e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-blue-500" />
            </div>
        </>;
      case ComponentType.Icon:
        return <PropertySelect label="아이콘" value={props.icon} onChange={e => handlePropChange('icon', e.target.value)} options={Object.keys(ICONS_MAP).map(name => ({value: name, label: name}))} />;
      case ComponentType.Progress:
         return <>
            <PropertyInput label="진행률 (%)" type="number" value={props.progress} onChange={e => handlePropChange('progress', Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))} />
             <div className="flex items-center justify-between mt-3">
              <label className="text-sm text-gray-300">레이블 표시</label>
              <input type="checkbox" checked={props.showLabel || false} onChange={e => handlePropChange('showLabel', e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-blue-500" />
            </div>
         </>;
      case ComponentType.Slider:
         return <PropertyInput label="값" type="number" value={props.value} onChange={e => handlePropChange('value', parseInt(e.target.value))} />;
      case ComponentType.Loader:
        return <PropertySelect label="스타일" value={props.style} onChange={e => handlePropChange('style', e.target.value)} options={[
          {value: 'spinner', label: 'Spinner'}, {value: 'dots', label: 'Dots'}
        ]} />;
      case ComponentType.Toggle:
        return <>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-300">켜짐</label>
              <input type="checkbox" checked={props.isOn || false} onChange={e => handlePropChange('isOn', e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-blue-500" />
            </div>
            <PropertyInput label="왼쪽 텍스트" value={props.leftLabel || ''} onChange={e => handlePropChange('leftLabel', e.target.value)} />
            <PropertyInput label="오른쪽 텍스트" value={props.rightLabel || ''} onChange={e => handlePropChange('rightLabel', e.target.value)} />
        </>;
      case ComponentType.Radio:
        return <>
            <PropertyInput label="레이블" value={props.label} onChange={e => handlePropChange('label', e.target.value)} />
            <PropertyInput label="그룹 이름 (Name)" value={props.name} onChange={e => handlePropChange('name', e.target.value)} />
            <div className="flex items-center justify-between mt-3">
                <label className="text-sm text-gray-300">선택됨</label>
                <input type="checkbox" checked={props.checked || false} onChange={e => handlePropChange('checked', e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-blue-500" />
            </div>
        </>;
      case ComponentType.Checkbox:
        return <>
            <PropertyInput label="레이블" value={props.label} onChange={e => handlePropChange('label', e.target.value)} />
            <div className="flex items-center justify-between mt-3">
                <label className="text-sm text-gray-300">선택됨</label>
                <input type="checkbox" checked={props.checked || false} onChange={e => handlePropChange('checked', e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-blue-500" />
            </div>
        </>;
      case ComponentType.Tabs:
        const tabs: string[] = props.tabs || [];
        const handleTabChange = (index: number, value: string) => {
            const newTabs = [...tabs];
            newTabs[index] = value;
            handlePropChange('tabs', newTabs);
        };
        const addTab = () => {
            handlePropChange('tabs', [...tabs, `탭 ${tabs.length + 1}`]);
        };
        const removeTab = (index: number) => {
            const newTabs = tabs.filter((_, i) => i !== index);
            handlePropChange('tabs', newTabs);
            if(props.activeTab >= newTabs.length) {
                handlePropChange('activeTab', Math.max(0, newTabs.length - 1));
            }
        };
        return (
            <div className="space-y-4">
              <div>
                {tabs.map((tab, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <input type="text" value={tab} onChange={e => handleTabChange(index, e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm" />
                    <button onClick={() => removeTab(index)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={addTab} className="w-full mt-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">탭 추가</button>
              </div>
              <PropertySelect label="스타일" value={props.style} onChange={e => handlePropChange('style', e.target.value)} options={[
                  {value: 'line', label: 'Line'},
                  {value: 'pill', label: 'Pill'},
                  {value: 'segmented', label: 'Segmented'}
              ]} />
            </div>
        );
      case ComponentType.Accordion:
        const items: {title: string, content: string}[] = props.items || [];
        const handleItemChange = (index: number, field: 'title' | 'content', value: string) => {
            const newItems = [...items];
            newItems[index] = {...newItems[index], [field]: value};
            handlePropChange('items', newItems);
        };
        const addItem = () => {
            handlePropChange('items', [...items, { title: `항목 ${items.length + 1}`, content: '새로운 내용' }]);
        };
        const removeItem = (index: number) => {
            const newItems = items.filter((_, i) => i !== index);
            handlePropChange('items', newItems);
            if(props.openItem >= newItems.length) {
                handlePropChange('openItem', Math.max(0, newItems.length - 1));
            }
        };
        return (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="bg-gray-700 p-2 rounded">
                  <div className="flex justify-end">
                    <button onClick={() => removeItem(index)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                  <PropertyInput label={`항목 ${index + 1} 제목`} value={item.title} onChange={e => handleItemChange(index, 'title', e.target.value)} />
                  <PropertyInput as="textarea" label={`항목 ${index + 1} 내용`} value={item.content} onChange={e => handleItemChange(index, 'content', e.target.value)} />
                </div>
              ))}
              <button onClick={addItem} className="w-full mt-2 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">항목 추가</button>
            </div>
        );
      case ComponentType.Popover:
        return <>
            <PropertyInput label="제목" value={props.title} onChange={e => handlePropChange('title', e.target.value)} />
            <PropertySelect label="방향" value={props.placement} onChange={e => handlePropChange('placement', e.target.value)} options={[
                {value: 'top', label: '위'},
                {value: 'bottom', label: '아래'},
                {value: 'left', label: '왼쪽'},
                {value: 'right', label: '오른쪽'}
            ]} />
        </>;
      case ComponentType.BarChart:
      case ComponentType.LineChart:
      case ComponentType.PieChart:
      case ComponentType.Misc:
        return null;

      default:
        return null;
    }
  }

  const renderComponentProperties = () => {
    if (!component) {
        return (
            <div className="p-4 flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    <p className="mt-2 text-sm">수정할 컴포넌트를 선택하세요.</p>
                </div>
            </div>
        );
    }
    const { styles, type } = component;
    const presets = COMPONENT_PRESETS[type] || [];
    const hasText = [ComponentType.Button, ComponentType.Text, ComponentType.Input, ComponentType.Alert, ComponentType.Radio, ComponentType.Checkbox].includes(type);

    const stylePresets = type === ComponentType.Button ? presets.filter(p => p.type === 'style' || !p.type) : presets;

    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-lg">{component.type}</span>
          <div className="flex items-center gap-2">
              <button onClick={duplicateComponent} title="복제 (Ctrl+D)" className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"><DuplicateIcon className="w-4 h-4" /></button>
              <button onClick={deleteComponent} title="삭제 (Delete)" className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"><TrashIcon className="w-4 h-4" /></button>
          </div>
        </div>

        <PropertyGroup title="속성">
          <PropertyInput label="이름" value={component.name} onChange={e => handleNameChange(e.target.value)} />
          <PropertyInput as="textarea" label="설명 (역할/상태)" value={component.description} onChange={e => handleDescriptionChange(e.target.value)} />
        </PropertyGroup>
        
        {stylePresets.length > 0 && (
          <PropertyGroup title="스타일 프리셋">
              <div className="grid grid-cols-2 gap-2">
                  {stylePresets.map(preset => (
                      <button 
                          key={preset.name}
                          onClick={() => component && applyComponentPreset(component.id, preset)}
                          className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-center transition-colors"
                      >
                          {preset.name}
                      </button>
                  ))}
              </div>
          </PropertyGroup>
        )}

        {renderComponentSpecificProps() && (type === ComponentType.Button ? renderComponentSpecificProps() : <PropertyGroup title="고유 속성">{renderComponentSpecificProps()}</PropertyGroup>)}

        <PropertyGroup title="크기 및 위치">
          <div className="grid grid-cols-2 gap-2">
              <PropertyInput label="너비" type="number" value={component.size.width} onChange={e => handleSizeChange('width', parseInt(e.target.value, 10) || 0)} />
              <PropertyInput label="높이" type="number" value={component.size.height} onChange={e => handleSizeChange('height', parseInt(e.target.value, 10) || 0)} />
          </div>
           <div className="grid grid-cols-2 gap-2 mt-2">
              <PropertyInput label="X" type="number" value={Math.round(component.position.x)} readOnly onChange={()=>{}} />
              <PropertyInput label="Y" type="number" value={Math.round(component.position.y)} readOnly onChange={()=>{}} />
          </div>
        </PropertyGroup>

        {hasText && (
          <PropertyGroup title="텍스트">
             <PropertyColor label="색상" value={styles.color} onChange={v => handleStyleChange('color', v)} />
             <div className="grid grid-cols-2 gap-2">
              <PropertyInput label="크기 (px)" type="number" value={styles.fontSize} onChange={e => handleStyleChange('fontSize', parseInt(e.target.value, 10))} />
              <PropertySelect label="굵기" value={styles.fontWeight} onChange={e => handleStyleChange('fontWeight', e.target.value)} options={[
                  {value: '300', label: 'Light'}, {value: '400', label: 'Normal'}, {value: '500', label: 'Medium'}, {value: '600', label: 'Semibold'}, {value: '700', label: 'Bold'}
              ]} />
             </div>
             <PropertySelect label="정렬" value={styles.textAlign} onChange={e => handleStyleChange('textAlign', e.target.value)} options={[
                  {value: 'left', label: '왼쪽'}, {value: 'center', label: '가운데'}, {value: 'right', label: '오른쪽'}
              ]} />
          </PropertyGroup>
        )}

        <PropertyGroup title="채우기">
          <PropertyColor label="배경색" value={styles.backgroundColor} onChange={v => handleStyleChange('backgroundColor', v)} />
          { type === ComponentType.Progress && 
            <PropertyColor label="진행 막대 색" value={styles.barColor} onChange={v => handleStyleChange('barColor', v)} />
          }
        </PropertyGroup>

        <PropertyGroup title="테두리">
          <PropertyColor label="색상" value={styles.borderColor} onChange={v => handleStyleChange('borderColor', v)} />
          <div className="grid grid-cols-2 gap-2">
              <PropertyInput label="두께 (px)" type="number" value={styles.borderWidth} onChange={e => handleStyleChange('borderWidth', parseInt(e.target.value, 10))} />
              <PropertyInput label="반경 (px)" type="number" value={styles.borderRadius} onChange={e => handleStyleChange('borderRadius', parseInt(e.target.value, 10))} />
          </div>
        </PropertyGroup>
      </div>
    );
  };

  const renderDesignSpec = () => {
    return (
        <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 text-white">디자인 명세서</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="appName" className="block text-sm font-medium text-gray-300 mb-1">애플리케이션 이름</label>
                    <input
                        type="text"
                        id="appName"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예: My Awesome App"
                    />
                </div>
                <div>
                    <label htmlFor="appDescription" className="block text-sm font-medium text-gray-300 mb-1">애플리케이션 상세 설명</label>
                    <textarea
                        id="appDescription"
                        rows={6}
                        value={appDescription}
                        onChange={(e) => setAppDescription(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="이 앱의 목적, 주요 기능, 대상 사용자 등을 설명합니다."
                    />
                </div>
                <div>
                    <label htmlFor="screenDescription" className="block text-sm font-medium text-gray-300 mb-1">화면 설명</label>
                    <textarea
                        id="screenDescription"
                        rows={4}
                        value={screenDescription}
                        onChange={(e) => setScreenDescription(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="현재 디자인된 화면의 역할과 동작 방식을 설명합니다."
                    />
                </div>
            </div>
            <div className="mt-6">
                <button
                    onClick={handleGetAISuggestions}
                    disabled={isAiLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded-md font-semibold transition-colors disabled:bg-purple-800 disabled:cursor-wait"
                >
                    <SparklesIcon className={`h-4 w-4 ${isAiLoading ? 'animate-spin' : ''}`} />
                    {isAiLoading ? 'AI가 제안 중...' : 'AI로 내용 채우기'}
                </button>
            </div>
        </div>
    );
  };
  
  return (
    <aside className="w-72 bg-gray-900 border-l border-gray-700 flex-shrink-0 flex flex-col">
        <div className="flex border-b border-gray-700 flex-shrink-0">
            <button
                onClick={() => setActiveTab('properties')}
                disabled={!component}
                className={`flex-1 p-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'properties' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800'} disabled:text-gray-600 disabled:cursor-not-allowed`}
            >
                <CogIcon className="w-5 h-5" />
                <span>속성</span>
            </button>
            <button
                onClick={() => setActiveTab('spec')}
                className={`flex-1 p-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'spec' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            >
                <DocumentTextIcon className="w-5 h-5" />
                <span>명세</span>
            </button>
        </div>

        <div className="flex-grow overflow-y-auto properties-panel-scrollbar">
            {activeTab === 'properties' ? renderComponentProperties() : renderDesignSpec()}
        </div>
    </aside>
  );
};