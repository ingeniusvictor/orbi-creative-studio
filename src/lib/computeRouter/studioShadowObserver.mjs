import { evaluateStudioShadowRoute } from './studioShadow.mjs';

const SHADOW_EVENT = 'orbi:compute-router-shadow';

function routeFacts(context = {}) {
    return Object.freeze({
        operation: context.operation,
        modelId: context.modelId,
        aspectRatio: context.aspectRatio,
        resolution: context.resolution,
        durationSeconds: context.durationSeconds,
    });
}

async function defaultSnapshotProvider() {
    if (
        typeof window === 'undefined'
        || window.orbiComputeRouter?.isElectron !== true
        || typeof window.orbiComputeRouter.getReadinessSnapshot !== 'function'
    ) {
        return null;
    }
    return window.orbiComputeRouter.getReadinessSnapshot();
}

function defaultReportSink(report) {
    if (
        typeof window === 'undefined'
        || typeof window.dispatchEvent !== 'function'
        || typeof CustomEvent !== 'function'
    ) {
        return;
    }
    window.dispatchEvent(new CustomEvent(SHADOW_EVENT, {
        detail: report,
    }));
}

async function observeStudioShadowRoute(
    context,
    {
        getReadinessSnapshot = defaultSnapshotProvider,
        reportSink = defaultReportSink,
    } = {},
) {
    try {
        const facts = routeFacts(context);
        const readinessSnapshot = await getReadinessSnapshot();
        if (!readinessSnapshot) return null;

        const report = evaluateStudioShadowRoute({
            ...facts,
            readinessSnapshot,
        });

        try {
            reportSink(report);
        } catch {
            // Local observability must never affect the legacy generation path.
        }

        return report;
    } catch {
        return null;
    }
}

function scheduleStudioShadowObservation(context, options) {
    Promise.resolve()
        .then(() => observeStudioShadowRoute(context, options))
        .catch(() => {
            // Defensive: observeStudioShadowRoute is fail-soft, and scheduling
            // must never create an unhandled rejection in the Studio.
        });
}

export {
    SHADOW_EVENT,
    observeStudioShadowRoute,
    routeFacts,
    scheduleStudioShadowObservation,
};
