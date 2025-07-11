
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessageData, MessageSender } from '../types';
import { LEGION_COMMANDER_NAME } from '../constants';
import { TrashIcon, PencilIcon, BookOpenIcon, UserCircleIcon, CpuChipIcon, SaveIcon, XMarkIcon, ExclamationTriangleIcon, KeyIcon } from './Icons';
import Spinner from './Spinner';

interface ChatMessageProps {
  message: ChatMessageData;
  onDelete: (channelId: string, messageId: string) => void;
  onEdit: (channelId: string, messageId: string, newContent: string) => void;
  isProcessing?: boolean; 
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onDelete, onEdit, isProcessing }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [showDiary, setShowDiary] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.senderType === MessageSender.User;
  const isMinion = message.senderType === MessageSender.AI;
  const isSystem = message.senderType === MessageSender.System;

  const handleEdit = () => {
    if (editedContent.trim() !== message.content) {
      onEdit(message.channelId, message.id, editedContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);
  
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  if (isSystem) {
    // Special rendering for API key logs
    if (message.isApiKeyLog) {
      return (
        <div className="px-4 py-1 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <KeyIcon className="w-4 h-4 text-sky-500" />
          <span className="italic">{message.content}</span>
        </div>
      );
    }
    // Default rendering for other system messages
    return (
      <div className="px-4 py-2 text-center text-xs text-gray-500 italic">
        {message.content}
      </div>
    );
  }

  const avatar = isUser ? (
    <UserCircleIcon className="w-8 h-8 text-sky-400" title={LEGION_COMMANDER_NAME} />
  ) : (
    <CpuChipIcon className="w-8 h-8 text-emerald-400" title={`Minion: ${message.senderName}`} />
  );

  const senderNameDisplay = isUser ? LEGION_COMMANDER_NAME : message.senderName;
  
  // Render a dedicated "typing" indicator bubble for placeholder messages
  if (isMinion && isProcessing && message.content.trim() === '') {
    return (
      <div className="group flex gap-3 p-3">
        <div className="flex-shrink-0">{avatar}</div>
        <div className={`w-full max-w-[80%] flex flex-col items-start`}>
            <div className={`relative px-4 py-2 rounded-xl shadow bg-gray-700 text-gray-200 rounded-bl-none`}>
                 <div className="flex items-center gap-2">
                    <Spinner size="sm" color="text-gray-400" />
                    <span className="text-sm text-gray-400 italic">{message.senderName} is thinking...</span>
                </div>
            </div>
        </div>
      </div>
    );
  }


  return (
    <div className={`group flex gap-3 p-3 hover:bg-gray-800/50 transition-colors duration-150 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="flex-shrink-0">{avatar}</div>}
      <div className={`w-full max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-4 py-2 rounded-xl shadow ${
          isUser ? 'bg-sky-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-semibold ${isUser ? 'text-sky-200' : 'text-emerald-300'}`}>
              {senderNameDisplay}
            </span>
            <span className="text-xs text-gray-400 ml-2">{formatTimestamp(message.timestamp)}</span>
          </div>

          {isEditing ? (
            <div className="mt-1">
              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={handleTextareaChange}
                className="w-full p-2 text-sm bg-gray-600 text-gray-100 border border-gray-500 rounded-md resize-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={handleCancelEdit} className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-400 text-white rounded-md transition-colors">
                  <XMarkIcon className="w-4 h-4"/>
                </button>
                <button onClick={handleEdit} className="px-3 py-1 text-xs bg-sky-500 hover:bg-sky-600 text-white rounded-md transition-colors">
                  <SaveIcon className="w-4 h-4"/>
                </button>
              </div>
            </div>
          ) : (
             <div className="text-sm whitespace-pre-wrap break-words">
                {message.content}
                {isProcessing && <Spinner size="sm" color="text-gray-400 inline-block ml-2"/>}
             </div>
          )}
          
          {message.isError && (
            <div className="mt-2 p-2 bg-red-700/50 border border-red-500 rounded text-xs text-red-200 flex items-start gap-1">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
              <span>{message.content}</span>
            </div>
          )}

          <div className={`absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isEditing ? 'opacity-0' : ''}`}>
            {isUser && (
              <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-sky-300" title="Edit">
                <PencilIcon className="w-4 h-4" />
              </button>
            )}
            {isMinion && message.internalDiary && (
              <button onClick={() => setShowDiary(!showDiary)} className="p-1 text-gray-400 hover:text-emerald-300" title={`Toggle ${message.senderName}'s Diary`}>
                <BookOpenIcon className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => onDelete(message.channelId, message.id)} className="p-1 text-gray-400 hover:text-red-400" title="Delete">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        {isMinion && showDiary && message.internalDiary && (
          <div className="mt-2 p-3 w-full bg-gray-700/50 border border-gray-600 rounded-md shadow">
            <h4 className="text-xs font-semibold text-emerald-400 mb-1">Internal Diary ({message.senderName})</h4>
            <pre className="diary-content text-xs text-gray-300 bg-gray-800 p-2 rounded-sm overflow-x-auto">
              {JSON.stringify(message.internalDiary, null, 2)}
            </pre>
          </div>
        )}
      </div>
      {isUser && <div className="flex-shrink-0">{avatar}</div>}
    </div>
  );
};

export default ChatMessage;