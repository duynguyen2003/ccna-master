import React from 'react';
import DropdownSelect from '../../../components/ui/DropdownSelect';

const CustomSelect = ({ value, onChange, options, placeholder = 'Chọn...', ...props }) => (
  <DropdownSelect
    {...props}
    className="acm-input acm-custom-select"
    value={value ?? ''}
    aria-label={props['aria-label'] || placeholder}
    onChange={(event) => {
      const option = options.find((item) => String(item.value) === event.target.value);
      if (option) onChange(option.value);
    }}
  >
    {!options.some((option) => String(option.value) === String(value ?? '')) && (
      <option value="" disabled>
        {placeholder}
      </option>
    )}
    {options.map((option) => (
      <option key={option.value} value={option.value} disabled={option.disabled}>
        {option.label}
      </option>
    ))}
  </DropdownSelect>
);
export default CustomSelect;
