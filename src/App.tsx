import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Play, 
  Trophy, 
  UserPlus, 
  UserMinus, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCcw,
  Table as TableIcon,
  Trash2,
  Save,
  Plus,
  FileText,
  Download
} from 'lucide-react';
import { Player, Tournament, Round, Match, Color } from './types';
import { generateNextRound } from './lib/swiss';
import { exportPairingToWord, exportRankingsToWord } from './lib/export';

export default function App() {
  const [tournament, setTournament] = useState<Tournament>({
    players: [],
    rounds: [],
    currentRound: 0,
    totalRounds: 5, // Default
  });

  const [newPlayerName, setNewPlayerName] = useState('');
  const [view, setView] = useState<'players' | 'pairing' | 'standings'>('players');
  const [displayedRoundNumber, setDisplayedRoundNumber] = useState(0);

  // Manual Pairing State
  const [isManualMode, setIsManualMode] = useState(false);
  const [tempMatches, setTempMatches] = useState<Match[]>([]);
  const [tempByeId, setTempByeId] = useState<string | null>(null);
  const [selectedForManual, setSelectedForManual] = useState<string[]>([]); // Max 2

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedNames, setPastedNames] = useState('');

  const addMultiplePlayers = () => {
    const names = pastedNames.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    const newPlayers: Player[] = names.map(name => ({
      id: Math.random().toString(36).substr(2, 9),
      name,
      score: 0,
      history: [],
      colorHistory: [],
      receivedBye: false,
    }));
    setTournament(prev => ({
      ...prev,
      players: [...prev.players, ...newPlayers],
    }));
    setPastedNames('');
    setShowPasteModal(false);
  };

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newPlayer: Player = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPlayerName.trim(),
      score: 0,
      history: [],
      colorHistory: [],
      receivedBye: false,
    };
    setTournament(prev => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }));
    setNewPlayerName('');
  };

  const removePlayer = (id: string) => {
    if (tournament.rounds.length > 0) return; // Cannot remove after starting
    setTournament(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id),
    }));
  };

  const startNextRoundAuto = () => {
    const nextRoundNumber = tournament.currentRound + 1;
    const nextRound = generateNextRound(tournament.players, nextRoundNumber);
    
    setTournament(prev => ({
      ...prev,
      currentRound: nextRoundNumber,
      rounds: [...prev.rounds, nextRound],
    }));
    setDisplayedRoundNumber(nextRoundNumber);
    setView('pairing');
  };

  const initManualRound = () => {
    setIsManualMode(true);
    setTempMatches([]);
    setTempByeId(null);
    setSelectedForManual([]);
    setView('pairing');
  };

  const handleManualSelect = (playerId: string) => {
    if (selectedForManual.includes(playerId)) {
      setSelectedForManual(prev => prev.filter(id => id !== playerId));
      return;
    }
    
    if (selectedForManual.length < 2) {
      const newList = [...selectedForManual, playerId];
      setSelectedForManual(newList);
      
      if (newList.length === 2) {
        // Automatically create a match when 2 are selected
        const [whiteId, blackId] = newList;
        const newMatch: Match = {
          id: `manual-${Date.now()}-${tempMatches.length}`,
          white: whiteId,
          black: blackId,
          result: null
        };
        setTempMatches(prev => [...prev, newMatch]);
        setSelectedForManual([]);
      }
    }
  };

  const setManualBye = (playerId: string) => {
    if (tempByeId === playerId) {
      setTempByeId(null);
    } else {
      setTempByeId(playerId);
    }
  };

  const removeTempMatch = (matchId: string) => {
    setTempMatches(prev => prev.filter(m => m.id !== matchId));
  };

  const finalizeManualRound = () => {
    const nextRoundNumber = tournament.currentRound + 1;
    const pairedPlayerIds = new Set<string>();
    tempMatches.forEach(m => {
      pairedPlayerIds.add(m.white);
      pairedPlayerIds.add(m.black);
    });
    if (tempByeId) pairedPlayerIds.add(tempByeId);

    if (pairedPlayerIds.size < tournament.players.length) {
      if (!confirm('Vẫn còn người chơi chưa được ghép cặp. Tiếp tục?')) return;
    }

    const nextRound: Round = {
      roundNumber: nextRoundNumber,
      matches: tempMatches,
      byePlayerId: tempByeId
    };

    setTournament(prev => ({
      ...prev,
      currentRound: nextRoundNumber,
      rounds: [...prev.rounds, nextRound],
    }));
    setDisplayedRoundNumber(nextRoundNumber);
    setIsManualMode(false);
  };

  const updateMatchResult = (matchId: string, result: Match['result']) => {
    setTournament(prev => {
      const newRounds = prev.rounds.map(r => {
        if (r.roundNumber === prev.currentRound) {
          return {
            ...r,
            matches: r.matches.map(m => m.id === matchId ? { ...m, result } : m)
          };
        }
        return r;
      });
      return { ...prev, rounds: newRounds };
    });
  };

  const finishRound = () => {
    const activeRound = tournament.rounds.find(r => r.roundNumber === tournament.currentRound);
    if (!activeRound) return;

    const allResolved = activeRound.matches.every(m => m.result !== null);
    if (!allResolved) {
      alert('Vui lòng nhập kết quả cho tất cả các ván đấu!');
      return;
    }

    setTournament(prev => {
      const updatedPlayers = [...prev.players].map(p => {
        let scoreAdd = 0;
        let opponentId: string | null = null;
        let myColor: Color | null = null;

        // Check if player had a BYE
        if (activeRound.byePlayerId === p.id) {
          return {
            ...p,
            score: p.score + 1,
            receivedBye: true,
            colorHistory: [...p.colorHistory, Color.BYE],
          };
        }

        // Find match for this player
        const match = activeRound.matches.find(m => m.white === p.id || m.black === p.id);
        if (match) {
          const isWhite = match.white === p.id;
          opponentId = isWhite ? match.black : match.white;
          myColor = isWhite ? Color.WHITE : Color.BLACK;

          if (match.result === '1-0') scoreAdd = isWhite ? 1 : 0;
          else if (match.result === '0-1') scoreAdd = isWhite ? 0 : 1;
          else if (match.result === '0.5-0.5') scoreAdd = 0.5;
        }

        return {
          ...p,
          score: p.score + scoreAdd,
          history: opponentId ? [...p.history, opponentId] : p.history,
          colorHistory: myColor ? [...p.colorHistory, myColor] : p.colorHistory,
        };
      });

      return {
        ...prev,
        players: updatedPlayers,
      };
    });

    setView('standings');
  };

  const standings = useMemo(() => {
    const playersWithBuchholz = tournament.players.map(player => {
      const bh = player.history.reduce((sum, opponentId) => {
        const opponent = tournament.players.find(p => p.id === opponentId);
        return sum + (opponent?.score || 0);
      }, 0);
      return { ...player, buchholz: bh };
    });

    return playersWithBuchholz.sort((a, b) => 
      b.score - a.score || 
      (b.buchholz || 0) - (a.buchholz || 0) || 
      a.name.localeCompare(b.name)
    );
  }, [tournament.players]);

  const resetTournament = () => {
    if (confirm('Bạn có chắc chắn muốn đặt lại giải đấu? Tất cả dữ liệu sẽ bị xóa.')) {
      setTournament({
        players: [],
        rounds: [],
        currentRound: 0,
        totalRounds: 5,
      });
      setView('players');
    }
  };

  const deleteLastRound = () => {
    if (tournament.currentRound === 0) return;
    if (!confirm('Bạn có chắc chắn muốn xóa vòng đấu cuối cùng? Mọi kết quả của vòng này sẽ bị hủy.')) return;

    setTournament(prev => {
      const lastRound = prev.rounds[prev.rounds.length - 1];
      const prevRound = prev.currentRound - 1;

      // If the round was already finished (scored), we need to revert scores
      // Note: In our current logic, finishRound is called AFTER scores are updated 
      // but the 'rounds' array contains the match data.
      // Actually, my finishRound updates 'players' state. 
      // To properly revert, we'd need to store player states per round.
      // For simplicity in this version, we assume "Delete last round" is mostly for re-pairing before/during the round.
      // If the round is finished, we'll try to subtract points.
      
      const updatedPlayers = prev.players.map(p => {
        let scoreToSubtract = 0;
        let receivedByeInLast = lastRound.byePlayerId === p.id;
        
        const matchInLast = lastRound.matches.find(m => m.white === p.id || m.black === p.id);
        if (matchInLast && matchInLast.result) {
          const isWhite = matchInLast.white === p.id;
          if (matchInLast.result === '1-0') scoreToSubtract = isWhite ? 1 : 0;
          else if (matchInLast.result === '0-1') scoreToSubtract = isWhite ? 0 : 1;
          else if (matchInLast.result === '0.5-0.5') scoreToSubtract = 0.5;
        } else if (receivedByeInLast) {
          scoreToSubtract = 1;
        }

        return {
          ...p,
          score: p.score - scoreToSubtract,
          history: (matchInLast || receivedByeInLast) ? p.history.slice(0, -1) : p.history,
          colorHistory: (matchInLast || receivedByeInLast) ? p.colorHistory.slice(0, -1) : p.colorHistory,
          receivedBye: receivedByeInLast ? false : p.receivedBye
        };
      });

      return {
        ...prev,
        players: updatedPlayers,
        rounds: prev.rounds.slice(0, -1),
        currentRound: prevRound
      };
    });
    setDisplayedRoundNumber(tournament.currentRound - 1 || 0);
    if (tournament.currentRound === 1) setView('players');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-4 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-black tracking-tighter flex items-center gap-3"
            >
              <Trophy className="text-amber-500 w-10 h-10 drop-shadow-md animate-pulse" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500">
                TRƯỜNG TH RẠCH CHÈO
              </span>
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 mt-2"
            >
              <div className="h-1 w-12 bg-blue-600 rounded-full"></div>
              <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">
                Hệ thống thi đấu cờ vua tiêu chuẩn
              </p>
            </motion.div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setView('players')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'players' ? 'bg-white shadow-sm ring-1 ring-neutral-200' : 'text-neutral-500 hover:bg-neutral-100'}`}
            >
              Vận động viên
            </button>
            <button 
              onClick={() => { setView('pairing'); setDisplayedRoundNumber(tournament.currentRound); }}
              disabled={tournament.currentRound === 0}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'pairing' ? 'bg-white shadow-sm ring-1 ring-neutral-200' : 'text-neutral-500 hover:bg-neutral-100 disabled:opacity-30'}`}
            >
              Vòng đấu
            </button>
            <button 
              onClick={() => setView('standings')}
              disabled={tournament.players.length === 0}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'standings' ? 'bg-white shadow-sm ring-1 ring-neutral-200' : 'text-neutral-500 hover:bg-neutral-100 disabled:opacity-30'}`}
            >
              Bảng xếp hạng
            </button>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Sidebar: Quick Rankings */}
          <aside className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sticky top-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-blue-500" />
                Xếp hạng nhanh
              </h3>
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
                {standings.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">Chưa có dữ liệu</p>
                ) : (
                  standings.map((player, idx) => (
                    <div key={player.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-50/50 transition-all border border-transparent hover:border-blue-100">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          idx === 0 ? 'bg-blue-600 text-white shadow-sm' : 
                          idx === 1 ? 'bg-blue-100 text-blue-600' : 
                          idx === 2 ? 'bg-sky-100 text-sky-600' : 
                          'bg-neutral-100 text-neutral-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-medium text-sm break-words leading-tight text-neutral-700">{player.name}</span>
                      </div>
                      <span className="font-bold text-blue-600 text-sm ml-2 flex-shrink-0">{player.score}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* Right Main Content Area */}
          <main className="lg:col-span-9 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden min-h-[500px]">
          <AnimatePresence mode="wait">
            
            {/* VIEW: Players */}
            {view === 'players' && (
              <motion.div 
                key="view-players"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-6"
              >
                <div className="flex flex-col md:flex-row gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-amber-900 mb-1">Số vòng đấu dự kiến:</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        value={tournament.totalRounds}
                        onChange={(e) => setTournament(prev => ({ ...prev, totalRounds: parseInt(e.target.value) }))}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="w-12 text-center font-bold text-xl text-amber-600">{tournament.totalRounds}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="Tên người chơi..." 
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-lg"
                    />
                    <UserPlus className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
                  </div>
                  <button 
                    onClick={() => setShowPasteModal(true)}
                    className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Thêm hàng loạt
                  </button>
                  <button 
                    onClick={addPlayer}
                    disabled={!newPlayerName.trim()}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Thêm kỳ thủ
                  </button>
                </div>

                {showPasteModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
                    >
                      <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                        <h3 className="text-xl font-bold">Thêm nhiều kỳ thủ</h3>
                        <button onClick={() => setShowPasteModal(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
                      </div>
                      <div className="p-6 space-y-4">
                        <p className="text-sm text-neutral-500">Nhập danh sách tên kỳ thủ, mỗi người một dòng:</p>
                        <textarea 
                          className="w-full h-64 p-4 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          placeholder="Nguyễn Văn A&#10;Trần Thị B&#10;Lê Văn C..."
                          value={pastedNames}
                          onChange={(e) => setPastedNames(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                          <button 
                            onClick={() => setShowPasteModal(false)}
                            className="px-4 py-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-all"
                          >
                            Hủy
                          </button>
                          <button 
                            onClick={addMultiplePlayers}
                            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-all"
                          >
                            Xác nhận
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Danh sách kỳ thủ ({tournament.players.length})</h3>
                  {tournament.players.length === 0 ? (
                    <div className="py-12 text-center text-neutral-400 italic">Chưa có người chơi nào được thêm.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {tournament.players.map(player => (
                        <div key={player.id} className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-xl group hover:border-amber-200 transition-all">
                          <span className="font-medium text-lg">{player.name}</span>
                          {tournament.rounds.length === 0 && (
                            <button 
                              onClick={() => removePlayer(player.id)}
                              className="text-neutral-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {tournament.players.length >= 2 && tournament.rounds.length === 0 && (
                  <div className="pt-6 border-t border-neutral-100 flex justify-end gap-4">
                    <button 
                      onClick={initManualRound}
                      className="px-6 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-semibold transition-all flex items-center gap-2"
                    >
                      Bốc thăm thủ công
                    </button>
                    <button 
                      onClick={startNextRoundAuto}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 group"
                    >
                      Bắt đầu giải đấu
                      <Play className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* VIEW: Pairing */}
            {view === 'pairing' && (
              <motion.div 
                key="view-pairing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-6"
              >
                {isManualMode ? (
                  // MANUAL PAIRING UI
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold">Bốc thăm thủ công - Vòng {tournament.currentRound + 1}</h2>
                      <button 
                        onClick={() => { setIsManualMode(false); setView('players'); }}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        Hủy bỏ
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left: Player Pool */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">Kỳ thủ chưa ghép ({
                          tournament.players.filter(p => 
                            !tempMatches.some(m => m.white === p.id || m.black === p.id) && 
                            tempByeId !== p.id
                          ).length
                        })</h3>
                        <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                          {tournament.players
                            .filter(p => !tempMatches.some(m => m.white === p.id || m.black === p.id) && tempByeId !== p.id)
                            .map(player => (
                              <button 
                                key={player.id}
                                onClick={() => handleManualSelect(player.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                                  selectedForManual.includes(player.id) 
                                  ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-200' 
                                  : 'bg-neutral-50 border-neutral-200 hover:border-amber-300'
                                }`}
                              >
                                <div>
                                  <div className="font-bold">{player.name}</div>
                                  <div className="text-xs text-neutral-500">Điểm: {player.score}</div>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setManualBye(player.id); }}
                                    className="px-2 py-1 bg-amber-200 text-amber-800 text-[10px] font-bold rounded hover:bg-amber-300"
                                  >
                                    BYE
                                  </button>
                                </div>
                              </button>
                            ))}
                        </div>
                        {selectedForManual.length === 1 && (
                          <div className="p-3 bg-amber-50 rounded-lg text-amber-700 text-sm italic animate-pulse">
                            Đang chọn... Chọn kỳ thủ thứ 2 để tạo cặp đấu.
                          </div>
                        )}
                      </div>

                      {/* Right: Created Matches */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">Các cặp đã tạo ({tempMatches.length})</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                          {tempMatches.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-xl shadow-sm">
                              <div className="flex items-center gap-2 flex-1 justify-center">
                                <span className="font-bold">{tournament.players.find(p => p.id === m.white)?.name}</span>
                                <span className="text-neutral-300 mx-2">vs</span>
                                <span className="font-bold">{tournament.players.find(p => p.id === m.black)?.name}</span>
                              </div>
                              <button onClick={() => removeTempMatch(m.id)} className="text-neutral-300 hover:text-red-500 ml-4">✕</button>
                            </div>
                          ))}
                          {tempByeId && (
                            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-bold">
                              <span>{tournament.players.find(p => p.id === tempByeId)?.name} (BYE)</span>
                              <button onClick={() => setTempByeId(null)} className="text-amber-300 hover:text-amber-600">✕</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-neutral-100 flex justify-end">
                      <button 
                        onClick={finalizeManualRound}
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg"
                      >
                        Xác nhận ghép cặp
                      </button>
                    </div>
                  </div>
                ) : (
                  // NORMAL PAIRING/VIEWING UI
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2 whitespace-nowrap">
                          <TableIcon className="text-amber-500" />
                          Vòng {displayedRoundNumber} <span className="text-neutral-300 font-normal">/ {tournament.totalRounds}</span>
                        </h2>
                        
                        {/* Round Selector */}
                        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                          {tournament.rounds.map(r => (
                            <button
                              key={r.roundNumber}
                              onClick={() => setDisplayedRoundNumber(r.roundNumber)}
                              className={`px-3 py-1 rounded-md text-sm font-bold transition-all ${
                                displayedRoundNumber === r.roundNumber 
                                ? 'bg-white shadow-sm text-neutral-900' 
                                : 'text-neutral-400 hover:text-neutral-600'
                              }`}
                            >
                              {r.roundNumber}
                            </button>
                          ))}
                        </div>
                      </div>

                      {displayedRoundNumber !== tournament.currentRound && (
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100">
                          Đang xem lại
                        </div>
                      )}

                      <button 
                        onClick={() => {
                          const round = tournament.rounds.find(r => r.roundNumber === displayedRoundNumber);
                          if (round) exportPairingToWord(round, tournament.players, tournament.totalRounds);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-sm font-semibold transition-all"
                      >
                        <FileText className="w-4 h-4" />
                        Xuất file Word
                      </button>
                    </div>

                    <div className="space-y-4">
                      {tournament.rounds.find(r => r.roundNumber === displayedRoundNumber)?.matches.map((match, idx) => (
                        <div key={match.id} className="grid grid-cols-[1fr_80px_1fr] items-center gap-4 p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50">
                          {/* White */}
                          <div className="flex items-center gap-4 justify-end overflow-hidden">
                            <div className="text-right">
                              <div className="font-bold text-lg leading-tight break-words">{tournament.players.find(p => p.id === match.white)?.name}</div>
                              <div className="text-sm text-neutral-400">Điểm: {tournament.players.find(p => p.id === match.white)?.score}</div>
                            </div>
                            <div className="w-10 h-10 flex-shrink-0 bg-white border border-neutral-200 rounded-lg flex items-center justify-center font-bold shadow-sm text-xs">Trắng</div>
                          </div>

                          {/* Score Input */}
                          <div className="flex flex-col gap-2">
                             <div className="text-center font-mono text-[10px] text-neutral-400 h-4">BÀN {idx + 1}</div>
                             <select 
                               value={match.result || ''}
                               disabled={displayedRoundNumber !== tournament.currentRound}
                               onChange={(e) => updateMatchResult(match.id, e.target.value as Match['result'])}
                               className={`w-full text-center py-2 bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold appearance-none cursor-pointer hover:border-amber-300 transition-all shadow-sm ${displayedRoundNumber !== tournament.currentRound ? 'opacity-70 cursor-default' : ''}`}
                             >
                               <option value="" disabled>-</option>
                               <option value="1-0">1 - 0</option>
                               <option value="0.5-0.5">½ - ½</option>
                               <option value="0-1">0 - 1</option>
                             </select>
                          </div>

                          {/* Black */}
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-10 h-10 flex-shrink-0 bg-neutral-800 text-white rounded-lg flex items-center justify-center font-bold shadow-sm text-xs">Đen</div>
                            <div>
                              <div className="font-bold text-lg leading-tight break-words">{tournament.players.find(p => p.id === match.black)?.name}</div>
                              <div className="text-sm text-neutral-400">Điểm: {tournament.players.find(p => p.id === match.black)?.score}</div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {tournament.rounds.find(r => r.roundNumber === displayedRoundNumber)?.byePlayerId && (
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between text-amber-800">
                          <span className="font-medium">Miễn đấu (BYE):</span>
                          <span className="font-bold text-lg">{tournament.players.find(p => p.id === tournament.rounds.find(r => r.roundNumber === displayedRoundNumber)?.byePlayerId)?.name} (+1 điểm)</span>
                        </div>
                      )}
                    </div>

                    {displayedRoundNumber === tournament.currentRound && (
                      <div className="pt-6 flex justify-between gap-4">
                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-neutral-400 max-w-[400px] italic">
                            Ghi chú: Kết quả ván đấu sẽ được cập nhật vào bảng xếp hạng sau khi bạn chọn "Hoàn tất vòng đấu".
                          </p>
                          
                          <details className="text-sm text-neutral-500 cursor-pointer group">
                            <summary className="hover:text-amber-600 transition-all font-medium">Xem danh sách cặp đấu dạng văn bản (để copy)</summary>
                            <div className="mt-2 p-3 bg-neutral-100 rounded-lg font-mono text-xs whitespace-pre select-all">
                              {tournament.rounds.find(r => r.roundNumber === displayedRoundNumber)?.matches.map((m, i) => {
                                const w = tournament.players.find(p => p.id === m.white)?.name;
                                const b = tournament.players.find(p => p.id === m.black)?.name;
                                return `Bàn ${i + 1} | ${w} | ${b}\n`;
                              })}
                              {tournament.rounds.find(r => r.roundNumber === displayedRoundNumber)?.byePlayerId && (
                                `[${tournament.players.find(p => p.id === tournament.rounds.find(r => r.roundNumber === displayedRoundNumber)?.byePlayerId)?.name}] – BYE (1 điểm)`
                              )}
                            </div>
                          </details>
                        </div>

                        <div className="flex gap-3">
                          <button 
                            onClick={deleteLastRound}
                            className="px-6 py-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-semibold transition-all flex items-center gap-2"
                          >
                            <Trash2 className="w-5 h-5" />
                            Hủy vòng {tournament.currentRound}
                          </button>
                          <button 
                            onClick={finishRound}
                            className="px-8 py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2 group self-start"
                          >
                            Hoàn tất vòng đấu
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* VIEW: Standings */}
            {view === 'standings' && (
              <motion.div 
                key="view-standings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Trophy className="text-blue-500" />
                    Bảng xếp hạng ({tournament.currentRound === tournament.totalRounds ? 'Chung cuộc' : `Vòng ${tournament.currentRound}`})
                  </h2>

                  <button 
                    onClick={() => exportRankingsToWord(standings, tournament.currentRound, tournament.totalRounds)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold shadow-md shadow-blue-100"
                  >
                    <Download className="w-5 h-5" />
                    Xuất file Word
                  </button>
                </div>

                <div className="overflow-hidden border border-neutral-200 rounded-xl shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-blue-50 text-blue-900/60 text-xs font-bold uppercase tracking-widest border-b border-neutral-100">
                      <tr>
                        <th className="px-6 py-4">Hạng</th>
                        <th className="px-6 py-4">Tên kỳ thủ</th>
                        <th className="px-6 py-4">Điểm</th>
                        <th className="px-6 py-4" title="Tổng điểm của các đối thủ đã gặp">Hệ số BH</th>
                        <th className="px-6 py-4">Lịch sử màu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                      {standings.map((player, idx) => (
                        <tr key={player.id} className="hover:bg-blue-50/30 transition-all">
                          <td className="px-6 py-4">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm ${
                              idx === 0 ? 'bg-blue-600 text-white shadow-blue-100' : 
                              idx === 1 ? 'bg-blue-100 text-blue-600' : 
                              idx === 2 ? 'bg-sky-100 text-sky-600' : 
                              'bg-neutral-50 text-neutral-400'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-lg leading-tight break-words min-w-[200px] text-neutral-800">{player.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-sm border border-blue-100">
                              {player.score}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-neutral-500 font-medium">{player.buchholz}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1">
                              {player.colorHistory.map((c, i) => (
                                <div 
                                  key={i} 
                                  title={c === Color.WHITE ? 'Trắng' : c === Color.BLACK ? 'Đen' : 'BYE'}
                                  className={`w-3 h-3 rounded-full border border-neutral-200 ${c === Color.WHITE ? 'bg-white' : c === Color.BLACK ? 'bg-neutral-800' : 'bg-amber-400 border-amber-500'}`} 
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {tournament.currentRound < tournament.totalRounds ? (
                  <div className="pt-6 flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="text-blue-900">
                      <span className="font-semibold">Vòng vừa kết thúc: {tournament.currentRound} / {tournament.totalRounds}</span>
                      <p className="text-sm opacity-70">Ghép cặp tự động hoặc thủ công cho vòng tiếp theo.</p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={initManualRound}
                        className="px-6 py-3 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-semibold shadow-sm transition-all"
                      >
                        Bốc thăm thủ công
                      </button>
                      <button 
                        onClick={startNextRoundAuto}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all flex items-center gap-2 group"
                      >
                        Bốc thăm tự động
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-6 text-center space-y-4 bg-emerald-50 p-8 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-200">
                      <Trophy className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-emerald-900">Giải đấu đã kết thúc!</h3>
                    <p className="text-emerald-700">Chúc mừng nhà vô địch: <span className="font-bold underline text-lg">{standings[0]?.name}</span> ({standings[0]?.score} điểm)</p>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

        {/* Footer Actions */}
        <footer className="flex justify-center pt-8 border-t border-neutral-200">
           <button 
            onClick={resetTournament}
            className="flex items-center gap-2 text-neutral-400 hover:text-neutral-600 transition-all group"
          >
            <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            Làm mới giải đấu
          </button>
        </footer>

      </div>
    </div>
  );
}
