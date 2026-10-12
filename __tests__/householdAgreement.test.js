import fs from 'fs';
import path from 'path';
import {
  AGREEMENT_HIGHLIGHTS,
  AGREEMENT_SECTIONS,
  AGREEMENT_VERSION,
} from '../src/data/householdAgreement';

describe('agreement version', () => {
  it('matches the version the backend requires (otherwise every create/join is refused)', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'backend', 'src', 'households', 'service.ts'),
      'utf8',
    );
    const match = source.match(/export const CONSENT_VERSION = '([^']+)'/);
    expect(match).not.toBeNull();
    expect(AGREEMENT_VERSION).toBe(match[1]);
  });

  it('has real content in every section', () => {
    expect(AGREEMENT_SECTIONS.length).toBeGreaterThanOrEqual(4);
    AGREEMENT_SECTIONS.forEach((section) => {
      expect(section.heading.trim()).not.toBe('');
      expect(section.body.length).toBeGreaterThan(0);
      section.body.forEach((line) => expect(line.trim()).not.toBe(''));
    });
    expect(AGREEMENT_HIGHLIGHTS.length).toBeGreaterThan(0);
  });
});
