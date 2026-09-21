const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGETS = [
    {
        path: 'src/components/ImageStudio.js',
        required: [
            "image.src = typeof entry.url === 'string' ? entry.url : '';",
            "image.alt = typeof entry.prompt === 'string' && entry.prompt ? entry.prompt.substring(0, 30) : 'Generated';",
        ],
    },
    {
        path: 'src/components/VideoStudio.js',
        required: [
            "media.src = typeof entry.url === 'string' ? entry.url : '';",
            "media.preload = 'metadata';",
            'media.muted = true;',
        ],
    },
    {
        path: 'src/components/CinemaStudio.js',
        required: [
            "image.src = typeof entry.url === 'string' ? entry.url : '';",
            "label.textContent = t('cinema.load');",
        ],
    },
    {
        path: 'src/components/LipSyncStudio.js',
        required: [
            "media.src = typeof entry.url === 'string' ? entry.url : '';",
            "media.preload = 'metadata';",
            'media.muted = true;',
        ],
    },
];

test('P1C32 history renderers do not interpolate persisted history into thumb.innerHTML', () => {
    for (const target of TARGETS) {
        const source = fs.readFileSync(target.path, 'utf8');

        assert.equal(
            source.includes('thumb.innerHTML = `'),
            false,
            `${target.path} must not use thumb.innerHTML for persisted history`,
        );
        assert.equal(
            source.includes('<img src="\${entry.url}"'),
            false,
            `${target.path} must not interpolate entry.url into image HTML`,
        );
        assert.equal(
            source.includes('<video src="\${entry.url}"'),
            false,
            `${target.path} must not interpolate entry.url into video HTML`,
        );
        assert.equal(
            source.includes('\${entry.prompt?.substring'),
            false,
            `${target.path} must not interpolate persisted prompt text into HTML`,
        );

        for (const invariant of target.required) {
            assert.ok(source.includes(invariant), `${target.path} missing DOM-safety invariant: ${invariant}`);
        }
    }
});

test('P1C32 download controls are assembled with DOM APIs rather than persisted HTML', () => {
    for (const path of [
        'src/components/ImageStudio.js',
        'src/components/VideoStudio.js',
        'src/components/LipSyncStudio.js',
    ]) {
        const source = fs.readFileSync(path, 'utf8');
        assert.ok(source.includes("document.createElement('button')"), `${path} must create the history action button safely`);
        assert.ok(source.includes("document.createElementNS('http://www.w3.org/2000/svg', 'svg')"), `${path} must create the SVG safely`);
        assert.ok(source.includes('thumb.append(media, overlay);'), `${path} must append safe DOM nodes`);
    }
});
