
import React, { useState } from 'react';
import { ApiKey } from '../types';
import { KeyIcon, PlusIcon, TrashIcon } from './Icons';

interface ApiKeyManagerProps {
    apiKeys: ApiKey[];
    onAddApiKey: (name: string, key: string) => Promise<void>;
    onDeleteApiKey: (id: string) => Promise<void>;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ apiKeys, onAddApiKey, onDeleteApiKey }) => {
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [error, setError] = useState('');

    const handleAddKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim() || !newKeyValue.trim()) {
            setError('Key Name and Value cannot be empty.');
            return;
        }
        try {
            await onAddApiKey(newKeyName, newKeyValue);
            setNewKeyName('');
            setNewKeyValue('');
            setError('');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const maskApiKey = (key: string) => {
        if (key.length < 8) return '***';
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    return (
        <div className="text-gray-200">
            <p className="text-sm text-gray-400 mb-4">
                Add your Gemini API keys here to distribute requests and avoid rate limits. Keys are stored only in your browser's local storage.
            </p>

            <form onSubmit={handleAddKey} className="space-y-3 mb-6 p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                     <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Key Name (e.g., 'Personal Key')"
                        className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm placeholder-gray-500"
                    />
                     <button
                        type="submit"
                        className="p-2.5 text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
                    >
                        <PlusIcon className="w-5 h-5"/>
                    </button>
                </div>
                <input
                    type="password"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder="Enter API Key Value"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm placeholder-gray-500"
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
            </form>
            
            <h4 className="text-md font-semibold text-gray-300 mb-2">Saved Keys</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {apiKeys.length === 0 ? (
                    <p className="text-sm text-gray-500">No API keys saved.</p>
                ) : (
                    apiKeys.map(apiKey => (
                        <div key={apiKey.id} className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                            <div className="flex items-center gap-3">
                                <KeyIcon className="w-5 h-5 text-sky-400" />
                                <div>
                                    <p className="font-medium text-gray-200">{apiKey.name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{maskApiKey(apiKey.key)}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onDeleteApiKey(apiKey.id)}
                                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                                title={`Delete key "${apiKey.name}"`}
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ApiKeyManager;
