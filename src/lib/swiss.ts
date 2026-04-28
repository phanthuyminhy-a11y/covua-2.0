import { Player, Match, Color, Round } from '../types';

/**
 * Basic Swiss Pairing implementation.
 * Note: This is an approximation of the formal FIDE Swiss rules,
 * but covers the core requirements (no repeats, score matching, colors, and BYE).
 */

export function generateNextRound(players: Player[], roundNumber: number): Round {
  // 1. Sort players by score (descending)
  // Also include Buchholz as tie-breaker for consistent "lowest" definition
  const sortedPlayers = [...players].sort((a, b) => {
    const bhA = a.history.reduce((sum, opId) => sum + (players.find(p => p.id === opId)?.score || 0), 0);
    const bhB = b.history.reduce((sum, opId) => sum + (players.find(p => p.id === opId)?.score || 0), 0);
    return b.score - a.score || bhB - bhA || a.name.localeCompare(b.name);
  });

  let byePlayerId: string | null = null;
  let pairingPool = [...sortedPlayers];

  // 2. Handle BYE if odd number of players
  if (pairingPool.length % 2 !== 0) {
    // Priority: Lowest score, never received a BYE
    const nonByeCandidates = pairingPool.filter(p => !p.receivedBye);
    
    let selectedBye;
    if (nonByeCandidates.length > 0) {
      // Pick the last one (lowest score) who hasn't had a BYE
      selectedBye = nonByeCandidates[nonByeCandidates.length - 1];
    } else {
      // Fallback: everyone has had a BYE, pick the absolute lowest scorer
      selectedBye = pairingPool[pairingPool.length - 1];
    }

    if (selectedBye) {
      byePlayerId = selectedBye.id;
      pairingPool = pairingPool.filter(p => p.id !== selectedBye.id);
    }
  }

  // 3. Pairing with backtracking to find a valid set
  const matches: Match[] = [];
  const pairedIds = new Set<string>();

  function findMatches(index: number): boolean {
    if (index >= pairingPool.length) return true;

    const p1 = pairingPool[index];
    if (pairedIds.has(p1.id)) return findMatches(index + 1);

    // Try pairing p1 with others
    for (let j = index + 1; j < pairingPool.length; j++) {
      const p2 = pairingPool[j];
      
      if (!pairedIds.has(p2.id) && !p1.history.includes(p2.id)) {
        // Decide colors
        const [white, black] = decideColors(p1, p2);
        
        const match: Match = {
          id: `r${roundNumber}-m${matches.length}`,
          white: white.id,
          black: black.id,
          result: null,
        };

        matches.push(match);
        pairedIds.add(p1.id);
        pairedIds.add(p2.id);

        if (findMatches(index + 1)) return true;

        // Backtrack
        matches.pop();
        pairedIds.delete(p1.id);
        pairedIds.delete(p2.id);
      }
    }
    return false;
  }

  const success = findMatches(0);
  if (!success) {
    console.warn("Could not find a valid pairing that satisfies all strict constraints.");
    // In a real application, you might want to retry with relaxed constraints 
    // (e.g., allow color rule violations before repeat pairings).
  }

  // 4. Sort matches by total score of participants (descending)
  matches.sort((a, b) => {
    const scoreA = (players.find(p => p.id === a.white)?.score || 0) + (players.find(p => p.id === a.black)?.score || 0);
    const scoreB = (players.find(p => p.id === b.white)?.score || 0) + (players.find(p => p.id === b.black)?.score || 0);
    return scoreB - scoreA;
  });

  return {
    roundNumber,
    matches,
    byePlayerId,
  };
}

function decideColors(p1: Player, p2: Player): [Player, Player] {
  // Score preferences: 
  // - Negative score = played more Blacks than Whites (wants White)
  // - Positive score = played more Whites than Blacks (wants Black)
  
  const getBias = (p: Player) => {
    let bias = 0;
    p.colorHistory.forEach(c => {
      if (c === Color.WHITE) bias++;
      if (c === Color.BLACK) bias--;
    });
    return bias;
  };

  const getLastTwoSame = (p: Player) => {
    if (p.colorHistory.length < 2) return null;
    const last = p.colorHistory[p.colorHistory.length - 1];
    const prev = p.colorHistory[p.colorHistory.length - 2];
    return last === prev ? last : null;
  };

  const p1Bias = getBias(p1);
  const p2Bias = getBias(p2);
  const p1LastTwo = getLastTwoSame(p1);
  const p2LastTwo = getLastTwoSame(p2);

  // Forced colors based on 2-in-a-row rule
  if (p1LastTwo === Color.WHITE) return [p2, p1];
  if (p1LastTwo === Color.BLACK) return [p1, p2];
  if (p2LastTwo === Color.WHITE) return [p1, p2];
  if (p2LastTwo === Color.BLACK) return [p2, p1];

  // Preferred colors based on cumulative balance
  if (p1Bias > p2Bias) return [p2, p1]; // p1 has more Whites, so p1 should be Black
  if (p2Bias > p1Bias) return [p1, p2]; // p2 has more Whites, so p2 should be Black

  // Random or arbitrary if equal
  return Math.random() > 0.5 ? [p1, p2] : [p2, p1];
}
