import React, { useState, useEffect } from 'react';
import { MinionConfig, ModelOption, ApiKey } from '../types';
import { GEMINI_MODELS_OPTIONS } from '../constants';
import Spinner from './Spinner';

interface MinionConfigFormProps {
  initialConfig?: MinionConfig;
  onSave: (config: MinionConfig) => void;
  onCancel: () => void;
  existingNames: string[];
  apiKeys: ApiKey[];
}

const MinionConfigForm: React.FC<MinionConfigFormProps> = ({ initialConfig, onSave, onCancel, existingNames, apiKeys }) => {
  const [config, setConfig] = useState<MinionConfig>(
    initialConfig || {
      id: `minion-${Date.now()}`,
      name: '',
      provider: 'google',
      model_id: GEMINI_MODELS_OPTIONS[0]?.id || '',
      model_name: GEMINI_MODELS_OPTIONS[0]?.name || '',
      system_prompt_persona: 'You are an AI minion created by Steven, the Commander of the Gemini Legion of which you are a member. You are not a boring ass sterile AI assistant, you aim to mimic real authentic human dialogue and conversation flow naturally. Keep your messages relatively brief, like a real-time chat.',
      params: { temperature: 0.7 },
      opinionScores: {},
      status: 'Pending Configuration',
    }
  );
  
  const [selectedDropdownModel, setSelectedDropdownModel] = useState(GEMINI_MODELS_OPTIONS[0].id);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (initialConfig) {
      const isStandardModel = GEMINI_MODELS_OPTIONS.some(opt => opt.id === initialConfig.model_id && opt.id !== 'custom-model-entry');
      if (isStandardModel) {
        setSelectedDropdownModel(initialConfig.model_id);
      } else {
        setSelectedDropdownModel('custom-model-entry');
      }
      setConfig(initialConfig);
    } else {
        // Reset to default for new minion
        const defaultConfig: MinionConfig = {
            id: `minion-${Date.now()}`,
            name: '',
            provider: 'google',
            model_id: GEMINI_MODELS_OPTIONS[0]?.id || '',
            model_name: GEMINI_MODELS_OPTIONS[0]?.name || '',
            system_prompt_persona: 'You are an AI minion created by Steven, the Commander of the Gemini Legion of which you are a member. You are not a boring ass sterile AI assistant, you aim to mimic real authentic human dialogue and conversation flow naturally. Keep your messages relatively brief, like a real-time chat.',
            params: { temperature: 0.7 },
            opinionScores: {},
            status: 'Pending Configuration',
        };
        setConfig(defaultConfig);
        setSelectedDropdownModel(defaultConfig.model_id);
    }
  }, [initialConfig]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'temperature') {
      setConfig(prev => ({ ...prev, params: { ...prev.params, temperature: parseFloat(value) } }));
    } else if (name === 'name') {
      setConfig(prev => ({ ...prev, [name]: value }));
      if (!initialConfig || (initialConfig && initialConfig.name !== value)) {
        if (existingNames.includes(value)) {
          setNameError('This Minion name is already in use. Please choose a unique name.');
        } else {
          setNameError(null);
        }
      } else {
        setNameError(null);
      }
    } else {
      setConfig(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'apiKeyId') {
      setConfig(prev => ({ ...prev, apiKeyId: value === "default" ? undefined : value }));
    } else if (name === 'model_id_select') {
        setSelectedDropdownModel(value);
        if (value === 'custom-model-entry') {
            setConfig(prev => ({...prev, model_id: '', model_name: ''}));
        } else {
            const model = GEMINI_MODELS_OPTIONS.find(m => m.id === value);
            setConfig(prev => ({...prev, model_id: model!.id, model_name: model!.name}));
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError) return;
    if (!config.name.trim()) {
      setNameError("Minion Name cannot be empty.");
      return;
    }
    if (selectedDropdownModel === 'custom-model-entry' && !config.model_id.trim()) {
      // Add validation for custom model ID
      alert("Custom Model ID cannot be empty.");
      return;
    }
    onSave(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-gray-200">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Minion Name (Unique)</label>
        <input
          type="text"
          name="name"
          id="name"
          value={config.name}
          onChange={handleChange}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm placeholder-gray-500"
          placeholder="e.g., Alpha, CodexMinion"
          required
        />
        {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
      </div>

       <div>
        <label htmlFor="apiKeyId" className="block text-sm font-medium text-gray-300 mb-1">Assigned API Key</label>
        <select
          name="apiKeyId"
          id="apiKeyId"
          value={config.apiKeyId || "default"}
          onChange={handleSelectChange}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
          disabled={apiKeys.length === 0}
        >
          <option value="default">Default (Load Balanced)</option>
          {apiKeys.map(key => (
            <option key={key.id} value={key.id}>{key.name}</option>
          ))}
        </select>
        {apiKeys.length === 0 && <p className="mt-1 text-xs text-gray-400">Add keys in the Minion Roster to assign them.</p>}
      </div>
      
      <div>
        <label htmlFor="model_id_select" className="block text-sm font-medium text-gray-300 mb-1">Model</label>
        <select
          name="model_id_select"
          id="model_id_select"
          value={selectedDropdownModel}
          onChange={handleSelectChange}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
        >
          {GEMINI_MODELS_OPTIONS.map(model => (
            <option key={model.id} value={model.id}>{model.name}</option>
          ))}
        </select>
      </div>

      {selectedDropdownModel === 'custom-model-entry' && (
        <div className="space-y-4 p-4 border border-gray-600 rounded-md bg-gray-700/50">
           <div>
              <label htmlFor="model_id" className="block text-sm font-medium text-gray-300 mb-1">Custom Model ID</label>
              <input
                type="text"
                name="model_id"
                id="model_id"
                value={config.model_id}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm placeholder-gray-500"
                placeholder="e.g., gemini-1.5-pro-custom"
                required
              />
           </div>
           <div>
              <label htmlFor="model_name" className="block text-sm font-medium text-gray-300 mb-1">Custom Model Name (Optional)</label>
              <input
                type="text"
                name="model_name"
                id="model_name"
                value={config.model_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm placeholder-gray-500"
                placeholder="e.g., Gemini 1.5 Pro Custom"
              />
           </div>
        </div>
      )}

      <div>
        <label htmlFor="system_prompt_persona" className="block text-sm font-medium text-gray-300 mb-1">Persona & Fire Code (System Prompt)</label>
        <textarea
          name="system_prompt_persona"
          id="system_prompt_persona"
          value={config.system_prompt_persona}
          onChange={handleChange}
          rows={8}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm placeholder-gray-500"
          placeholder="Describe the Minion's personality, core directives, skills, quirks, etc."
        />
      </div>

      <div>
        <label htmlFor="temperature" className="block text-sm font-medium text-gray-300 mb-1">Temperature: {config.params.temperature.toFixed(2)}</label>
        <input
          type="range"
          name="temperature"
          id="temperature"
          min="0"
          max="1" 
          step="0.01"
          value={config.params.temperature}
          onChange={handleChange}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md shadow-sm transition-colors">Cancel</button>
        <button type="submit" disabled={!!nameError || !config.name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Save Minion Configuration</button>
      </div>
    </form>
  );
};

export default MinionConfigForm;