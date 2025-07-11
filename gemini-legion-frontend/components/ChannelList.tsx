
import React, { useState } from 'react';
import { Channel, ChannelPayload, MinionConfig } from '../types';
import { HashtagIcon, PlusIcon, PencilIcon } from './Icons';
import ChannelForm from './ChannelForm';

interface ChannelListProps {
  channels: Channel[];
  currentChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onAddOrUpdateChannel: (channel: ChannelPayload) => void;
  allMinionNames: string[];
}

const ChannelList: React.FC<ChannelListProps> = ({ channels, currentChannelId, onSelectChannel, onAddOrUpdateChannel, allMinionNames }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<Channel | undefined>(undefined);
    
    const handleOpenCreate = () => {
        setEditingChannel(undefined);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (channel: Channel) => {
        setEditingChannel(channel);
        setIsModalOpen(true);
    };

    return (
        <>
            <div className="w-64 bg-gray-800 border-r border-gray-700 flex-shrink-0 flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-100">Channels</h2>
                    <button 
                        onClick={handleOpenCreate}
                        className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md"
                        title="Create New Channel"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-grow p-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700">
                    {channels.map(channel => (
                        <div key={channel.id} className={`group w-full flex items-center rounded-md transition-colors ${
                            currentChannelId === channel.id ? 'bg-sky-600' : 'hover:bg-gray-700'
                        }`}>
                            <button
                                onClick={() => onSelectChannel(channel.id)}
                                className={`flex-grow flex items-center gap-2 px-3 py-2 text-left rounded-md ${
                                currentChannelId === channel.id ? 'text-white font-semibold' : 'text-gray-300 group-hover:text-gray-100'
                                }`}
                            >
                                <HashtagIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="truncate">{channel.name}</span>
                            </button>
                            {channel.type !== 'system_log' && (
                                 <button 
                                    onClick={() => handleOpenEdit(channel)}
                                    className={`p-1.5 mr-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                                        currentChannelId === channel.id ? 'opacity-100' : ''
                                    } ${
                                        currentChannelId === channel.id ? 'hover:bg-sky-500' : 'hover:bg-gray-600'
                                    }`}
                                    title={`Edit ${channel.name}`}
                                >
                                    <PencilIcon className="w-4 h-4"/>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <ChannelForm 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={onAddOrUpdateChannel}
                initialChannel={editingChannel}
                allMinionNames={allMinionNames}
            />
        </>
    );
};

export default ChannelList;
