// OSPF uses two recorded ticks to reach FULL. EIGRP converges within the command itself.
export const needsConvergence = (state) =>
  Object.values(state?.ospfNeighbors || {}).some((neighbor) =>
    ['INIT', 'EXCHANGE'].includes(neighbor.state)
  );
