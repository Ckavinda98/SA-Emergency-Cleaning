import { describe, it, expect } from 'vitest';
import { phoneError, emailError, passwordError, confirmPasswordError, personNameError, textError, sanitizePhoneInput, abnError } from '../../shared/validation.js';

describe('shared form validation', () => {
  it('accepts real Australian phone numbers', () => {
    for (const p of ['0412 345 678', '0412345678', '+61 412 345 678', '(08) 8123 4567', '08 8123 4567', '1300 123 456', '13 22 11']) {
      expect(phoneError(p)).toBe('');
    }
  });
  it('rejects letters and made-up numbers', () => {
    for (const p of ['888888888', '8888888888', '88888888887777777777', '0412abc678', '12345', '+1 202 555 0100', '']) {
      expect(phoneError(p)).not.toBe('');
    }
    expect(phoneError('', { required: false })).toBe('');
    expect(sanitizePhoneInput('04a12-b345')).toBe('0412-345');
  });
  it('checks email addresses properly', () => {
    expect(emailError('name@company.com.au')).toBe('');
    for (const e of ['test@gmail', 'a@b.c', 'no at.com', 'x@@y.com', 'a..b@x.com', '']) expect(emailError(e)).not.toBe('');
  });
  it('needs a strong password and a matching confirmation', () => {
    expect(passwordError('Password123!')).toBe('');
    for (const p of ['short', 'password123!', 'PASSWORD123!', 'Password!!!', 'Password123']) expect(passwordError(p)).not.toBe('');
    expect(confirmPasswordError('Password123!', 'Password123!')).toBe('');
    expect(confirmPasswordError('Password123!', 'Password123')).not.toBe('');
  });
  it('rejects numbers as a person or company name', () => {
    expect(personNameError('Mahima Sharma')).toBe('');
    expect(personNameError("Sean O'Brien-Smith")).toBe('');
    expect(personNameError('888888888')).not.toBe('');
    expect(textError('Charuka Adelaide Cleaning Service')).toBe('');
    expect(textError('88888')).not.toBe('');
    expect(abnError('48 123 456 789')).toBe('');
    expect(abnError('1234')).not.toBe('');
  });
});
