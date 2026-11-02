import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DropdownSelect from './DropdownSelect';

describe('DropdownSelect', () => {
  it('keeps its menu in a modal dialog and consumes Escape before the parent', () => {
    const parentKey = jest.fn();
    render(
      <dialog open aria-label="Hộp thoại" onKeyDown={parentKey}>
        <DropdownSelect aria-label="Thiết bị" value="R1" onChange={jest.fn()}>
          <option value="R1">R1</option>
        </DropdownSelect>
      </dialog>
    );
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    expect(within(screen.getByRole('dialog')).getByRole('listbox')).toBeTruthy();
    expect(fireEvent.mouseDown(screen.getByRole('option'), { cancelable: true })).toBe(false);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(parentKey).not.toHaveBeenCalled();
  });
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
