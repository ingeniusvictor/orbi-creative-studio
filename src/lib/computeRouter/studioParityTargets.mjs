import { normalizeTarget } from './parityCertification.mjs';

const STUDIO_PARITY_PROFILE_ID = 'studio-image-video-v1';
const STUDIO_PARITY_PROFILE_SCHEMA_VERSION = 1;

const RAW_STUDIO_PARITY_TARGETS = Object.freeze([
    Object.freeze({
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'wan2gp-lan',
        operation: 't2i',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'wan2gp-lan',
        operation: 't2v',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'wan2gp-lan',
        operation: 'i2v',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'muapi-cloud',
        operation: 't2i',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'muapi-cloud',
        operation: 'i2i',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'muapi-cloud',
        operation: 't2v',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'muapi-cloud',
        operation: 'i2v',
        minSamples: 10,
        minDistinctModels: 1,
    }),
    Object.freeze({
        expectedProviderId: 'muapi-cloud',
        operation: 'v2v',
        minSamples: 10,
        minDistinctModels: 1,
    }),
]);

const STUDIO_PARITY_TARGETS = Object.freeze(
    RAW_STUDIO_PARITY_TARGETS.map((target) => normalizeTarget(target)),
);

const STUDIO_PARITY_TARGET_PROFILE = Object.freeze({
    schemaVersion: STUDIO_PARITY_PROFILE_SCHEMA_VERSION,
    id: STUDIO_PARITY_PROFILE_ID,
    scope: 'electron-image-video-studios',
    targets: STUDIO_PARITY_TARGETS,
});

function getStudioParityTargetProfile() {
    return STUDIO_PARITY_TARGET_PROFILE;
}

export {
    STUDIO_PARITY_PROFILE_ID,
    STUDIO_PARITY_PROFILE_SCHEMA_VERSION,
    STUDIO_PARITY_TARGETS,
    STUDIO_PARITY_TARGET_PROFILE,
    getStudioParityTargetProfile,
};
