import { validateShadowCompatibilitySnapshot } from './shadowCompatibilityDiagnostics.mjs';

export const SHADOW_SNAPSHOT_HANDOFF_STATUS = Object.freeze({
    ACCEPTED: 'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED',
    UNCHANGED: 'SHADOW_SNAPSHOT_HANDOFF_UNCHANGED',
    REJECTED: 'SHADOW_SNAPSHOT_HANDOFF_REJECTED',
    STALE: 'SHADOW_SNAPSHOT_HANDOFF_STALE',
    CONFLICT: 'SHADOW_SNAPSHOT_HANDOFF_CONFLICT',
});

function cloneFrozenSnapshot(snapshot) {
    return Object.freeze({
        schemaVersion: snapshot.schemaVersion,
        snapshotType: snapshot.snapshotType,
        capturedAt: snapshot.capturedAt,
        mode: snapshot.mode,
        context: Object.freeze({ ...snapshot.context }),
        registry: Object.freeze({ ...snapshot.registry }),
        compatibility: Object.freeze({
            ...snapshot.compatibility,
            reasons: Object.freeze([...snapshot.compatibility.reasons]),
        }),
        hardware: Object.freeze({ ...snapshot.hardware }),
        resources: Object.freeze({
            systemRam: Object.freeze({ ...snapshot.resources.systemRam }),
            vram: Object.freeze({ ...snapshot.resources.vram }),
        }),
        boundaries: Object.freeze({ ...snapshot.boundaries }),
    });
}

function response(status, reason = null, capturedAt = null) {
    return Object.freeze({
        status,
        reason,
        capturedAt,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export function createShadowCompatibilitySnapshotHandoff() {
    let currentSnapshot = null;

    const publish = (snapshot) => {
        const validation = validateShadowCompatibilitySnapshot(snapshot);
        if (!validation.ok) {
            return response(SHADOW_SNAPSHOT_HANDOFF_STATUS.REJECTED, validation.reason);
        }

        const candidate = cloneFrozenSnapshot(snapshot);
        if (currentSnapshot) {
            const currentTime = Date.parse(currentSnapshot.capturedAt);
            const candidateTime = Date.parse(candidate.capturedAt);

            if (candidateTime < currentTime) {
                return response(
                    SHADOW_SNAPSHOT_HANDOFF_STATUS.STALE,
                    'HANDOFF_SNAPSHOT_OLDER_THAN_CURRENT',
                    currentSnapshot.capturedAt,
                );
            }

            if (candidateTime === currentTime) {
                if (JSON.stringify(candidate) === JSON.stringify(currentSnapshot)) {
                    return response(
                        SHADOW_SNAPSHOT_HANDOFF_STATUS.UNCHANGED,
                        null,
                        currentSnapshot.capturedAt,
                    );
                }

                return response(
                    SHADOW_SNAPSHOT_HANDOFF_STATUS.CONFLICT,
                    'HANDOFF_TIMESTAMP_CONFLICT',
                    currentSnapshot.capturedAt,
                );
            }
        }

        currentSnapshot = candidate;
        return response(
            SHADOW_SNAPSHOT_HANDOFF_STATUS.ACCEPTED,
            null,
            currentSnapshot.capturedAt,
        );
    };

    const read = () => currentSnapshot;

    return Object.freeze({
        publish,
        read,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

const defaultHandoff = createShadowCompatibilitySnapshotHandoff();

export function publishShadowCompatibilitySnapshot(snapshot) {
    return defaultHandoff.publish(snapshot);
}

export function readShadowCompatibilitySnapshot() {
    return defaultHandoff.read();
}

export { cloneFrozenSnapshot };
