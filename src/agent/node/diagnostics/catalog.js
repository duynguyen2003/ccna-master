const VERSION = 'sim01-r1-v1';
const LIMITS = Object.freeze({ devices: 6, links: 5, interfaces: 24, routes: 32, findings: 8 });
const CATALOG = Object.freeze(
  [
    {
      id: 'INTERFACE_ADMIN_DOWN',
      kind: 'INTERFACE',
      requires: 'physical path',
      confidence: 'OBSERVED',
    },
    { id: 'LINK_DOWN', kind: 'LINK', requires: 'physical path', confidence: 'OBSERVED' },
    {
      id: 'IP_ADDRESS_MISSING',
      kind: 'INTERFACE',
      requires: 'routed endpoint on path',
      confidence: 'OBSERVED',
    },
    {
      id: 'IP_SUBNET_INCONSISTENCY',
      kind: 'INTERFACE',
      requires: 'L3 neighbors on path',
      confidence: 'INFERRED',
    },
    {
      id: 'NO_USABLE_ROUTE',
      kind: 'ROUTE',
      requires: 'simulator route table, exact destination/direction',
      confidence: 'INFERRED',
    },
    {
      id: 'NEXT_HOP_UNRESOLVED',
      kind: 'ROUTE',
      requires: 'selected route and ARP timeout',
      confidence: 'INFERRED',
    },
    {
      id: 'VLAN_PATH_MISMATCH',
      kind: 'VLAN',
      requires: 'failed L2 path and access/trunk membership',
      confidence: 'INFERRED',
    },
  ].map((rule) =>
    Object.freeze({
      ...rule,
      version: VERSION,
      maxProbeCalls: 1,
      inputSchema: 'InternalAnalyzeRequest.context/request@1.0.0',
      outputSchema: 'InternalAnalyzeRequest.facts@1.0.0',
      supportedClaims: Object.freeze(['SUPPORTED_FINDING', 'HYPOTHESIS']),
    })
  )
);
module.exports = { VERSION, LIMITS, CATALOG };
