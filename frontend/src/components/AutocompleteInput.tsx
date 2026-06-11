import React, { useState, useEffect } from 'react';

interface AutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChangeValue: (val: string) => void;
  suggestions: string[];
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChangeValue,
  suggestions,
  style,
  className,
  placeholder,
  ...rest
}) => {
  const [suggestion, setSuggestion] = useState('');

  // Find suggestion that starts with value (case-insensitive)
  useEffect(() => {
    if (!value || value.trim() === '') {
      setSuggestion('');
      return;
    }
    const match = suggestions.find(s => 
      s && s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
    );
    setSuggestion(match || '');
  }, [value, suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
      e.preventDefault();
      onChangeValue(suggestion);
      setSuggestion('');
    }
    if (rest.onKeyDown) {
      rest.onKeyDown(e);
    }
  };

  // Extract ghost text part
  const ghostText = suggestion && suggestion.toLowerCase().startsWith(value.toLowerCase())
    ? suggestion.slice(value.length)
    : '';

  return (
    <div style={{ position: 'relative', width: style?.width || '100%', display: 'inline-block' }}>
      {/* Ghost text display layer */}
      {ghostText && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            padding: style?.padding || '0.45rem 0.75rem',
            fontSize: style?.fontSize || '0.85rem',
            fontFamily: 'inherit',
            pointerEvents: 'none',
            whiteSpace: 'pre',
            width: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          <span style={{ color: 'transparent' }}>{value}</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>{ghostText}</span>
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          ...style,
          background: 'transparent',
          position: 'relative',
          zIndex: 2
        }}
        className={className}
        placeholder={placeholder}
        {...rest}
      />
    </div>
  );
};

export default AutocompleteInput;
