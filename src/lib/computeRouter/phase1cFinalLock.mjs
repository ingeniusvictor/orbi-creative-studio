export const PHASE_1C_FINAL_LOCK = Object.freeze({
    phase: '1C',
    finalMilestone: 'P1C70',
    closed: true,
    closedScope: 'local-ai-compute-router-governance-foundation',
    nextPhase: 'Phase 2 — Creative Product Integration & ORBI UX',
    prohibitedContinuation: Object.freeze([
        'P1C71',
        'automatic-production-profile-promotion',
        'automatic-routing-activation',
        'automatic-cutover-authorization',
    ]),
    authority: Object.freeze({
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    }),
});

export function getPhase1CFinalLock() {
    return PHASE_1C_FINAL_LOCK;
}
