
import React, { useState } from 'react';
import { MinionConfig, ApiKey } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, CpuChipIcon, XMarkIcon as CloseIcon, KeyIcon } from './Icons';
import Modal from './Modal';
import MinionConfigForm from './LLMConfigForm';
import ApiKeyManager from './ApiKeyManager';

interface MinionsPanelProps {
  minionConfigs: MinionConfig[];
  apiKeys: ApiKey[];
  onAddMinion: (config: MinionConfig) => void;
  onUpdateMinion: (config: MinionConfig) => void;
  onDeleteMinion: (id: string) => void;
  onAddApiKey: (name: string, key: string) => Promise<void>;
  onDeleteApiKey: (id: string) => Promise<void>;
  isOpen: boolean;
  onToggle: () => void;
}

const MinionsPanel: React.FC<MinionsPanelProps> = ({
  minionConfigs,
  apiKeys,
  onAddMinion,
  onUpdateMinion,
  onDeleteMinion,
  onAddApiKey,
  onDeleteApiKey,
  isOpen,
  onToggle,
}) => {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [editingMinion, setEditingMinion] = useState<MinionConfig | undefined>(undefined);

  const handleAddNew = () => {
    setEditingMinion(undefined);
    setIsConfigModalOpen(true);
  };

  const handleEdit = (config: MinionConfig) => {
    setEditingMinion(config);
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = (config: MinionConfig) => {
    if (editingMinion) {
      onUpdateMinion(config);
    } else {
      onAddMinion(config);
    }
    setIsConfigModalOpen(false);
    setEditingMinion(undefined);
  };
  
  const handleDelete = (id: string) => {
    if (window.confirm(`Are you sure you want to decommission Minion: ${minionConfigs.find(m=>m.id===id)?.name || id}? This action cannot be undone.`)) {
        onDeleteMinion(id);
    }
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-30" onClick={onToggle}></div>}
      
      <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-gray-800 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out border-l border-gray-700 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
            <h2 className="text-xl font-semibold text-gray-100">Minion Roster</h2>
            <button onClick={onToggle} className="p-1 text-gray-400 hover:text-white">
              <CloseIcon className="w-6 h-6"/>
            </button>
          </div>

          <div className="flex-grow p-4 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700">
            {minionConfigs.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No Minions deployed. Add one to begin operations!</p>
            )}
            {minionConfigs.map(config => (
              <div key={config.id} className="p-3 bg-gray-700 rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                     <CpuChipIcon className="w-6 h-6 text-emerald-400 flex-shrink-0"/>
                    <div className="overflow-hidden">
                      <h3 className="text-md font-semibold text-gray-100 truncate" title={config.name}>{config.name}</h3>
                      <p className="text-xs text-gray-400 truncate" title={config.model_id}>{config.model_name || config.model_id}</p>
                      <p className="text-xs text-lime-400/80 truncate" title={config.status || "Status Unknown"}>{config.status || "Status Unknown"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(config)} className="p-1.5 text-gray-400 hover:text-sky-400 transition-colors" title={`Edit ${config.name}'s Configuration`}>
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(config.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title={`Decommission ${config.name}`}>
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-700 space-y-3 flex-shrink-0">
             <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-sky-300 bg-gray-700 hover:bg-gray-600 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500"
            >
              <KeyIcon className="w-5 h-5" />
              Manage API Keys
            </button>
            <button
              onClick={handleAddNew}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500"
            >
              <PlusIcon className="w-5 h-5" />
              Deploy New Minion
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title={editingMinion ? `Configure Minion: ${editingMinion.name}` : 'Deploy New Minion'}
        size="lg"
      >
        <MinionConfigForm
          initialConfig={editingMinion}
          onSave={handleSaveConfig}
          onCancel={() => setIsConfigModalOpen(false)}
          existingNames={minionConfigs.map(c => c.name).filter(name => !editingMinion || name !== editingMinion.name)}
          apiKeys={apiKeys}
        />
      </Modal>
      
      <Modal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        title="Manage API Keys"
        size="md"
      >
        <ApiKeyManager
            apiKeys={apiKeys}
            onAddApiKey={onAddApiKey}
            onDeleteApiKey={onDeleteApiKey}
        />
      </Modal>
    </>
  );
};

export default MinionsPanel;
