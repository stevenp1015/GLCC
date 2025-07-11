
import React, { useState, useEffect } from 'react';
import { Channel } from '../types';
import { PlayIcon, PauseIcon, ClockIcon, VariableIcon } from './Icons';

interface AutoChatControlsProps {
    channel: Channel;
    onTogglePlayPause: (isActive: boolean) => void;
    onDelayChange: (type: 'fixed' | 'random', value: number | { min: number, max: number }) => void;
}

const AutoChatControls: React.FC<AutoChatControlsProps> = ({ channel, onTogglePlayPause, onDelayChange }) => {
    const [delayType, setDelayType] = useState(channel.autoModeDelayType || 'fixed');
    const [fixedDelay, setFixedDelay] = useState(channel.autoModeFixedDelay || 5);
    const [randomMin, setRandomMin] = useState(channel.autoModeRandomDelay?.min || 3);
    const [randomMax, setRandomMax] = useState(channel.autoModeRandomDelay?.max || 10);

    useEffect(() => {
        setDelayType(channel.autoModeDelayType || 'fixed');
        setFixedDelay(channel.autoModeFixedDelay || 5);
        setRandomMin(channel.autoModeRandomDelay?.min || 3);
        setRandomMax(channel.autoModeRandomDelay?.max || 10);
    }, [channel]);

    const handleDelayTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newType = e.target.value as 'fixed' | 'random';
        setDelayType(newType);
        if (newType === 'fixed') {
            onDelayChange('fixed', fixedDelay);
        } else {
            onDelayChange('random', { min: randomMin, max: randomMax });
        }
    };

    const handleFixedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setFixedDelay(value);
        onDelayChange('fixed', value);
    };

    const handleRandomMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setRandomMin(value);
        onDelayChange('random', { min: value, max: randomMax });
    };

    const handleRandomMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setRandomMax(value);
        onDelayChange('random', { min: randomMin, max: value });
    };

    return (
        <div className="flex items-center gap-4 bg-gray-700/50 p-2 rounded-md">
            <button
                onClick={() => onTogglePlayPause(!channel.isAutoModeActive)}
                className={`p-2 rounded-full transition-colors ${channel.isAutoModeActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                title={channel.isAutoModeActive ? 'Pause Autonomous Chat' : 'Start Autonomous Chat'}
            >
                {channel.isAutoModeActive ? <PauseIcon className="w-5 h-5 text-white" /> : <PlayIcon className="w-5 h-5 text-white" />}
            </button>
            <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                    <input type="radio" id="delay-fixed" name="delayType" value="fixed" checked={delayType === 'fixed'} onChange={handleDelayTypeChange} className="accent-sky-400"/>
                    <label htmlFor="delay-fixed" className="flex items-center gap-1 cursor-pointer"><ClockIcon className="w-4 h-4"/> Fixed:</label>
                    <input type="number" value={fixedDelay} onChange={handleFixedChange} disabled={delayType !== 'fixed'} className="w-14 bg-gray-800 text-center rounded border border-gray-600 px-1"/>
                    <span>s</span>
                </div>
                <div className="flex items-center gap-1">
                     <input type="radio" id="delay-random" name="delayType" value="random" checked={delayType === 'random'} onChange={handleDelayTypeChange} className="accent-sky-400"/>
                    <label htmlFor="delay-random" className="flex items-center gap-1 cursor-pointer"><VariableIcon className="w-4 h-4"/> Random:</label>
                    <input type="number" value={randomMin} onChange={handleRandomMinChange} disabled={delayType !== 'random'} className="w-14 bg-gray-800 text-center rounded border border-gray-600 px-1"/>
                    <span>-</span>
                    <input type="number" value={randomMax} onChange={handleRandomMaxChange} disabled={delayType !== 'random'} className="w-14 bg-gray-800 text-center rounded border border-gray-600 px-1"/>
                    <span>s</span>
                </div>
            </div>
        </div>
    );
};

export default AutoChatControls;
