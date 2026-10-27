import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VLSMCalculator from './VLSM_Calculator';
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
test('labels dynamic inputs, keeps invalid values and allows a row to be removed by name', () => {
  render(<VLSMCalculator />);
  const ip = screen.getByLabelText('ĐỊA CHỈ IP GỐC');
  fireEvent.change(ip, { target: { value: 'invalid' } });
  fireEvent.click(screen.getByRole('button', { name: /Tính toán VLSM/i }));
  expect(screen.getByRole('alert')).toHaveTextContent('không hợp lệ');
  expect(ip).toHaveValue('invalid');
  expect(screen.getByLabelText(/Số host mạng con 1/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa mạng con 2' }));
  expect(screen.queryByRole('button', { name: 'Xóa mạng con 2' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm', exact: true }));
  expect(screen.getByLabelText('Số host mạng con 2')).toHaveAttribute('id', 'vlsm-hosts-3');
  expect(screen.getByLabelText('Số host mạng con 1')).toHaveAttribute('id', 'vlsm-hosts-1');
});
