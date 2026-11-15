import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomSelect from './CustomSelect';

test('preserves numeric option IDs with keyboard selection and respects disabled', () => {
  const onChange = jest.fn();
  const props = {
    value: 1,
    onChange,
    options: [
      { value: 1, label: 'Một' },
      { value: 2, label: 'Hai' },
    ],
    'aria-label': 'Khóa học',
  };
  const { rerender } = render(<CustomSelect {...props} />);
  const trigger = screen.getByRole('combobox', { name: 'Khóa học' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'End' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith(2);
  rerender(<CustomSelect {...props} disabled />);
  expect(trigger).toBeDisabled();
});
