import { describe, it, expect } from 'vitest';
import BRAND from '../electron/shared/brand.json';
import pkg from '../package.json';

describe('Afus Hanout identity (docs/NAMING.md)', () => {
    it('brand.json names Afus Hanout', () => {
        expect(BRAND).toEqual({
            companyName: 'Afus',
            productName: 'Afus Hanout',
            shortName: 'Afus',
            appId: 'dz.afus.hanout',
            packageName: 'afus-hanout',
            executableName: 'AfusHanout',
            dataDirName: 'AfusHanout',
            databaseFile: 'afus-hanout.db',
            fileSlug: 'afus-hanout',
        });
    });

    it('macOS files carry the Hanout name', () => {
        expect(pkg.build.mac.artifactName).toBe('Afus-Hanout-${version}-${arch}-mac.${ext}');
        expect(pkg.build.dmg.artifactName).toBe('Afus-Hanout-${version}-${arch}.${ext}');
    });
});
