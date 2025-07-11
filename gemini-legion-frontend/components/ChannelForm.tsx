
import React, { useState, useEffect } from 'react';
import { Channel, ChannelPayload, ChannelType, MinionConfig } from '../types';
import Modal from './Modal';
import { CpuChipIcon, UserCircleIcon } from './Icons';
import { LEGION_COMMANDER_NAME } from '../constants';

interface ChannelFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (channel: ChannelPayload) => void;
    initialChannel?: Channel;
    allMinionNames: string[];
}

const ChannelForm: React.FC<ChannelFormProps> = ({ isOpen, onClose, onSave, initialChannel, allMinionNames }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<ChannelType>('user_minion_group');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (initialChannel) {
                setName(initialChannel.name);
                setDescription(initialChannel.description || '');
                setType(initialChannel.type);
                setSelectedMembers(initialChannel.members || []);
            } else {
                // Reset form for new channel
                setName('');
                setDescription('');
                setType('user_minion_group');
                setSelectedMembers([LEGION_COMMANDER_NAME, ...allMinionNames]);
            }
        }
    }, [initialChannel, isOpen, allMinionNames]);

    const handleMemberToggle = (memberName: string) => {
        setSelectedMembers(prev =>
            prev.includes(memberName)
                ? prev.filter(m => m !== memberName)
                : [...prev, memberName]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const payload: ChannelPayload = {
            id: initialChannel?.id,
            name: name.startsWith('#') ? name : `#${name}`,
            description,
            type,
            members: type === 'system_log' ? [] : Array.from(new Set(selectedMembers)),
        };
        onSave(payload);
        onClose();
    };

    const typeDescriptions: Record<ChannelType, string> = {
        user_minion_group: "Standard chat with Commander and selected Minions.",
        minion_minion_auto: "Autonomous chat between selected Minions, started by a Commander prompt.",
        system_log: "Read-only logs from the Legion System. No members."
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialChannel ? `Edit Channel: ${initialChannel.name}` : 'Create New Channel'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="channel-name" className="block text-sm font-medium text-gray-300">Channel Name</label>
                    <input id="channel-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="#strategy-discussion" required />
                </div>
                <div>
                    <label htmlFor="channel-description" className="block text-sm font-medium text-gray-300">Description</label>
                    <input id="channel-description" type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        placeholder="What is this channel for?" />
                </div>
                <div>
                    <label htmlFor="channel-type" className="block text-sm font-medium text-gray-300">Channel Type</label>
                    <select id="channel-type" value={type} onChange={(e) => setType(e.target.value as ChannelType)}
                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm">
                        <option value="user_minion_group">Group Chat</option>
                        <option value="minion_minion_auto">Autonomous Swarm</option>
                        <option value="system_log">System Log</option>
                    </select>
                    <p className="mt-2 text-xs text-gray-400">{typeDescriptions[type]}</p>
                </div>

                {type !== 'system_log' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Channel Members</label>
                        <div className="mt-2 p-3 bg-gray-700/50 rounded-md max-h-48 overflow-y-auto space-y-2">
                            {/* Commander is always a member and cannot be removed */}
                            <div className="flex items-center">
                                <input id="member-commander" type="checkbox" checked={true} disabled className="h-4 w-4 rounded border-gray-500 text-sky-600" />
                                <label htmlFor="member-commander" className="ml-3 flex items-center gap-2 text-sm text-gray-400 cursor-not-allowed">
                                    <UserCircleIcon className="w-5 h-5 text-sky-400" /> {LEGION_COMMANDER_NAME} (Commander)
                                </label>
                            </div>
                            {allMinionNames.map(minionName => (
                                <div key={minionName} className="flex items-center">
                                    <input id={`member-${minionName}`} type="checkbox"
                                        checked={selectedMembers.includes(minionName)}
                                        onChange={() => handleMemberToggle(minionName)}
                                        className="h-4 w-4 rounded border-gray-500 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                                    <label htmlFor={`member-${minionName}`} className="ml-3 flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                                        <CpuChipIcon className="w-5 h-5 text-emerald-400" /> {minionName}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md">
                        Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
                        {initialChannel ? 'Save Changes' : 'Create Channel'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ChannelForm;
