import type { CSSProperties } from 'react';

export const secondaryBtnStyle: CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

export function primaryBtnStyle(color: string): CSSProperties {
  return {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    border: 'none',
    background: color,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

export const textareaStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  fontFamily: 'inherit',
  resize: 'vertical',
};
