
import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isSending: boolean;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isSending, disabled = false }) => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (inputValue.trim() && !isSending && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // Reset height
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    setInputValue(event.currentTarget.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${event.currentTarget.scrollHeight}px`;
    }
  };
  
  useEffect(() => {
    if (textareaRef.current) {
        // Adjust initial height if needed, or keep it minimal
        textareaRef.current.style.height = '44px'; // Approx 1 line height + padding
    }
  }, []);


  return (
    <div className={`p-4 bg-gray-800 border-t border-gray-700 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-end gap-2 bg-gray-700 rounded-xl p-2 shadow-md">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Pause autonomous mode to send a message..." : "Type your message... (Shift+Enter for new line)"}
          className="flex-grow p-2.5 bg-transparent text-gray-200 placeholder-gray-500 border-none rounded-lg resize-none focus:ring-0 outline-none max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700"
          rows={1}
          disabled={isSending || disabled}
        />
        <button
          onClick={handleSubmit}
          disabled={isSending || !inputValue.trim() || disabled}
          className="p-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Send message"
        >
          {isSending ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <PaperAirplaneIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
