import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DropdownSelect from './DropdownSelect';

describe('DropdownSelect', () => {
  it('opens a scrollable listbox and preserves the select change event shape', () => {
    const onChange = jest.fn();
    render(
      <DropdownSelect aria-label="Giao thức" value="icmp" onChange={onChange}>
        <option value="icmp">ICMP</option>
        <option value="tcp">TCP</option>
        <option value="udp">UDP</option>
      </DropdownSelect>
    );

    const trigger = screen.getByRole('combobox', { name: 'Giao thức' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: 'tcp' }) })
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not open when disabled and selects options by pointer', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DropdownSelect aria-label="Loại" value="a" onChange={onChange} disabled>
        <option value="a">Loại A</option>
        <option value="b">Loại B</option>
      </DropdownSelect>
    );

    const disabledTrigger = screen.getByRole('combobox', { name: 'Loại' });
    fireEvent.click(disabledTrigger);
    expect(screen.queryByRole('listbox')).toBeNull();

    rerender(
      <DropdownSelect aria-label="Loại" value="a" onChange={onChange}>
        <option value="a">Loại A</option>
        <option value="b">Loại B</option>
      </DropdownSelect>
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Loại' }));
    fireEvent.click(screen.getByRole('option', { name: 'Loại B' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: 'b' }) })
    );
  });
});
