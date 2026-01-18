
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateWeeklyQuiz } from './services/geminiService';
import { Question, QuizPoint, AppTab, LeaderboardEntry } from './types';
import { getDistance, getNextPoint } from './utils/geo';
import GameMap from './components/GameMap';

// Constants
const UNLOCK_DISTANCE = 200; // Total distance required to move in any direction

const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.PROFILE);
  const [isWalkActive, setIsWalkActive] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [points, setPoints] = useState<QuizPoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [lastActionLocation, setLastActionLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [weeklyTrophies, setWeeklyTrophies] = useState<string[]>(['V3', 'V4']);

  // User profile state
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('tp_user_name') || 'Vandrare #42');
  const [profilePic, setProfilePic] = useState<string>(() => localStorage.getItem('tp_profile_pic') || 'https://picsum.photos/seed/me/200');

  useEffect(() => {
    localStorage.setItem('tp_user_name', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('tp_profile_pic', profilePic);
  }, [profilePic]);

  // Fetch data
  useEffect(() => {
    const init = async () => {
      const q = await generateWeeklyQuiz();
      setQuestions(q);
    };
    init();
  }, []);

  // Location tracking
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Unlock logic: Check displacement from lastActionLocation
  useEffect(() => {
    if (isWalkActive && userLocation && lastActionLocation && !isUnlocked) {
      const dist = getDistance(
        userLocation.lat,
        userLocation.lng,
        lastActionLocation.lat,
        lastActionLocation.lng
      );
      if (dist >= UNLOCK_DISTANCE) {
        setIsUnlocked(true);
        if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
      }
    }
  }, [userLocation, lastActionLocation, isUnlocked, isWalkActive]);

  const startWalk = async () => {
    let currentQuestions = questions;
    if (currentQuestions.length === 0) {
      currentQuestions = await generateWeeklyQuiz();
      setQuestions(currentQuestions);
    }

    const startPos = userLocation || { lat: 59.3293, lng: 18.0686 };
    setLastActionLocation(startPos);
    
    // Generera den första målpunkten automatiskt
    const targetPoint = getNextPoint(startPos.lat, startPos.lng, UNLOCK_DISTANCE);
    
    setPoints([{
      id: 1,
      lat: targetPoint.lat,
      lng: targetPoint.lng,
      unlocked: false,
      answered: false
    }]);
    
    setCurrentIndex(0);
    setTotalScore(0);
    setIsWalkActive(true);
    setActiveTab(AppTab.MAP);
    setIsUnlocked(false);
  };

  const handleAnswer = (choice: '1' | 'X' | '2') => {
    const currentQ = questions[currentIndex];
    const isCorrect = choice === currentQ.correct;
    
    let newScore = totalScore;
    if (isCorrect) newScore += 1;
    setTotalScore(newScore);

    const updatedPoints = [...points];
    updatedPoints[currentIndex] = {
      ...updatedPoints[currentIndex],
      answered: true,
      isCorrect: isCorrect
    };

    if (currentIndex < 9) {
      const currentPos = userLocation || points[currentIndex];
      setLastActionLocation(currentPos);
      
      const nextTarget = getNextPoint(currentPos.lat, currentPos.lng, UNLOCK_DISTANCE);
      updatedPoints.push({
        id: currentIndex + 2,
        lat: nextTarget.lat,
        lng: nextTarget.lng,
        unlocked: false,
        answered: false
      });
      
      setPoints(updatedPoints);
      setCurrentIndex(prev => prev + 1);
      setIsUnlocked(false);
      setIsAnswering(false);
    } else {
      setPoints(updatedPoints);
      setIsAnswering(false);
      setShowSummary(true);
      setIsWalkActive(false);
      if (newScore === 10) {
        setWeeklyTrophies(prev => [...prev, `V${getWeekNumber(new Date())}`]);
      }
    }
  };

  if (showSplash) {
    return (
      <div 
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#22c55e] to-[#2563eb] text-white p-8 text-center animate-in fade-in duration-1000"
        onClick={() => setShowSplash(false)}
      >
        <div className="animate-logo bg-white w-40 h-40 rounded-[3rem] flex items-center justify-center text-8xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] mb-10 border-8 border-white/20">📍</div>
        <h1 className="text-5xl font-black tracking-tighter mb-4 italic drop-shadow-lg text-white uppercase">Tipspromenaden</h1>
        <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 mb-12">
            <p className="text-white font-black uppercase tracking-[0.3em] text-xs">Vandra • Svara • Vinn</p>
        </div>
        <div className="absolute bottom-16 text-white/40 text-sm font-bold animate-pulse">Klicka var som helst för att börja</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className={`${activeTab === AppTab.MAP ? 'absolute' : 'relative'} top-0 left-0 right-0 z-20 px-4 py-4 flex justify-between items-center pointer-events-none`}>
        <div className="bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl border border-white/50 pointer-events-auto">
          <h1 className="text-lg font-black text-green-600 tracking-tight leading-none uppercase">Tipspromenaden</h1>
        </div>
        {isWalkActive && (
          <div className="bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl border border-white/50 flex items-center space-x-2 pointer-events-auto">
            <span className="text-sm font-black text-blue-600">{totalScore}</span>
            <span className="text-[10px] text-gray-400 font-black uppercase">RÄTT</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden bg-[#aad3df]">
        <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === AppTab.MAP ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <GameMap 
            userLocation={userLocation} 
            lastActionLocation={lastActionLocation}
            points={points} 
            currentIndex={currentIndex}
            onSimulateMove={(lat, lng) => setUserLocation({ lat, lng })}
            isWalkActive={isWalkActive}
            unlockDistance={UNLOCK_DISTANCE}
          />
          {isWalkActive && (
            <div className="absolute top-20 left-4 right-4 z-20 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-5 shadow-2xl border border-white/50 pointer-events-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest leading-none">Vecka {getWeekNumber(new Date())}</span>
                  <span className="text-sm font-black text-blue-600 leading-none">FRÅGA {currentIndex + 1} / 10</span>
                </div>
                <div className="w-full bg-blue-50 h-3 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${((currentIndex + 1) / 10) * 100}%` }}></div>
                </div>
              </div>
            </div>
          )}

          {isUnlocked && isWalkActive && !isAnswering && !points[currentIndex]?.answered && (
            <div className="absolute bottom-10 left-6 right-6 flex justify-center z-20">
              <button onClick={() => setIsAnswering(true)} className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-7 rounded-[3rem] shadow-[0_12px_0_rgb(21,128,61)] active:shadow-none active:translate-y-2 transform transition-all text-2xl flex items-center justify-center space-x-4">
                <span className="text-4xl">📝</span>
                <span>Svara på fråga {currentIndex + 1}</span>
              </button>
            </div>
          )}

          {!isWalkActive && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-black/20 pointer-events-none">
               <div className="bg-white/95 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/50 pointer-events-auto max-w-sm scale-in-center">
                  <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-6xl shadow-inner">🚶‍♂️</div>
                  <h3 className="text-3xl font-black text-gray-900 mb-4 leading-tight text-gray-900">Starta äventyret!</h3>
                  <div className="p-5 bg-orange-50 rounded-2xl border-2 border-orange-100 text-left mb-8">
                     <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest mb-1">Regler & Säkerhet</p>
                     <p className="text-[12px] font-bold text-orange-900 leading-tight">
                       Vandra 200 meter oavsett riktning för att låsa upp nästa fråga. Om den automatiska målpunkten hamnar på en otillgänglig plats, fortsätt bara vandra på en säker väg så låses frågan upp ändå.
                     </p>
                  </div>
                  <button onClick={() => setActiveTab(AppTab.PROFILE)} className="w-full bg-green-500 text-white py-6 rounded-3xl font-black shadow-xl text-xl active:scale-95 transition-transform">KOM IGÅNG</button>
               </div>
            </div>
          )}
        </div>

        {/* Dynamic Screens */}
        <div className={`h-full overflow-y-auto bg-gray-50 pt-16 transition-transform duration-300 ${activeTab === AppTab.MAP ? 'translate-y-full' : 'translate-y-0'}`}>
            {activeTab === AppTab.LEADERBOARD && <LeaderboardView userName={userName} profilePic={profilePic} />}
            {activeTab === AppTab.FRIENDS && <FriendsView />}
            {activeTab === AppTab.PROFILE && <ProfileView totalScore={totalScore} weeklyTrophies={weeklyTrophies} onStartWalk={startWalk} isWalkActive={isWalkActive} userName={userName} profilePic={profilePic} onUpdateProfile={(name, pic) => { setUserName(name); setProfilePic(pic); }} />}
        </div>

        {/* Summary Overlay */}
        {showSummary && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-2xl z-[60] p-10 flex flex-col items-center justify-center animate-in zoom-in duration-500">
            <div className="text-9xl mb-10 animate-bounce">🏆</div>
            <h2 className="text-5xl font-black text-gray-900 mb-4 tracking-tighter italic text-black uppercase">Bra jobbat!</h2>
            <div className="bg-blue-50 w-full max-w-sm rounded-[3.5rem] p-12 border-4 border-blue-100 shadow-2xl mb-14 text-center">
              <div className="text-[12px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">Resultat vecka {getWeekNumber(new Date())}</div>
              <div className="text-8xl font-black text-blue-600 tabular-nums">{totalScore} <span className="text-3xl text-blue-300">/ 10</span></div>
            </div>
            <button onClick={() => { setShowSummary(false); setActiveTab(AppTab.PROFILE); }} className="w-full max-w-sm bg-green-500 text-white font-black py-7 rounded-[3rem] shadow-[0_12px_0_rgb(21,128,61)] active:shadow-none active:translate-y-2 transform transition-all text-2xl uppercase">Avsluta</button>
          </div>
        )}

        {/* Quiz Question Modal */}
        {isAnswering && (
          <div className="absolute inset-0 bg-white z-[70] p-8 flex flex-col animate-in slide-in-from-bottom duration-500 overflow-y-auto">
            <div className="flex justify-between items-center mb-10 shrink-0">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">{currentIndex + 1}</div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight text-black">Fråga {currentIndex + 1}</h2>
              </div>
              <button onClick={() => setIsAnswering(false)} className="p-5 bg-gray-100 rounded-full text-gray-400 active:scale-90 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full pb-10">
              <div className="bg-blue-50 rounded-[3.5rem] p-12 mb-12 border-4 border-blue-100 shadow-inner relative overflow-hidden">
                <p className="text-3xl font-black text-blue-900 leading-tight relative z-10 text-blue-900">{questions[currentIndex]?.text}</p>
                <div className="absolute -top-10 -right-4 text-[10rem] opacity-5 pointer-events-none transform rotate-12">?</div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {(['1', 'X', '2'] as const).map((key) => (
                  <button key={key} onClick={() => handleAnswer(key)} className="group flex items-center p-7 bg-white border-4 border-gray-100 hover:border-blue-500 hover:bg-blue-50 rounded-[3rem] transition-all active:scale-95 shadow-xl">
                    <div className="w-18 h-18 shrink-0 flex items-center justify-center bg-gray-100 group-hover:bg-blue-600 text-gray-400 group-hover:text-white rounded-2xl font-black text-3xl mr-8 transition-all shadow-sm">{key}</div>
                    <span className="text-2xl font-black text-gray-700 group-hover:text-blue-900 flex-1 text-left leading-tight text-gray-700">{questions[currentIndex]?.options[key]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-2xl border-t border-gray-100 flex justify-around items-center pt-3 pb-10 px-6 safe-area-bottom z-[80] shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <NavButton active={activeTab === AppTab.PROFILE} onClick={() => setActiveTab(AppTab.PROFILE)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} label="Profil" />
        <NavButton active={activeTab === AppTab.MAP} onClick={() => setActiveTab(AppTab.MAP)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Karta" />
        <NavButton active={activeTab === AppTab.LEADERBOARD} onClick={() => setActiveTab(AppTab.LEADERBOARD)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} label="Ranking" />
        <NavButton active={activeTab === AppTab.FRIENDS} onClick={() => setActiveTab(AppTab.FRIENDS)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} label="Vänner" />
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center space-y-1 transition-all ${active ? 'text-blue-600 scale-110' : 'text-gray-300'}`}>
    <div className={`${active ? 'bg-blue-50 p-3 rounded-2xl shadow-inner' : 'p-3'} transition-all`}>{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-[0.2em]">{label}</span>
  </button>
);

const LeaderboardView: React.FC<{ userName: string, profilePic: string }> = ({ userName, profilePic }) => {
  const [filter, setFilter] = useState<'NATIONAL' | 'FRIENDS'>('NATIONAL');
  const mockData: LeaderboardEntry[] = [
    { id: '1', name: 'Anders Svensson', score: 10, avatar: 'https://picsum.photos/seed/1/100' },
    { id: '2', name: userName, score: 8, avatar: profilePic, isMe: true },
    { id: '3', name: 'Maria Lindgren', score: 7, avatar: 'https://picsum.photos/seed/3/100' },
    { id: '4', name: 'Kalle Blomkvist', score: 6, avatar: 'https://picsum.photos/seed/4/100' },
  ];
  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 pb-24">
        <h2 className="text-4xl font-black text-gray-900 mb-8 tracking-tight italic text-black uppercase">Ranking</h2>
        <div className="flex bg-gray-200 rounded-3xl p-1.5 mb-8">
          <button onClick={() => setFilter('NATIONAL')} className={`flex-1 py-4 px-4 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all ${filter === 'NATIONAL' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500'}`}>Sverige</button>
          <button onClick={() => setFilter('FRIENDS')} className={`flex-1 py-4 px-4 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all ${filter === 'FRIENDS' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500'}`}>Vänner</button>
        </div>
        <div className="space-y-4">
          {mockData.map((entry, idx) => (
            <div key={entry.id} className={`flex items-center p-6 rounded-[2.5rem] border-2 transition-all ${entry.isMe ? 'bg-blue-50 border-blue-200 shadow-xl scale-105 z-10' : 'bg-white border-gray-100 shadow-sm'}`}>
              <div className={`w-10 font-black text-2xl ${idx < 3 ? 'text-orange-500' : 'text-gray-300'}`}>{idx + 1}</div>
              <img src={entry.avatar} className="w-16 h-16 rounded-2xl mr-5 border-2 border-white shadow-md object-cover" alt="" />
              <div className="flex-1 font-black text-gray-800 text-xl tracking-tight text-gray-800">{entry.name}</div>
              <div className="flex flex-col items-end">
                <span className="font-black text-3xl text-blue-600 leading-none">{entry.score}</span>
                <span className="text-[11px] font-black uppercase text-gray-400 mt-1">RÄTT</span>
              </div>
            </div>
          ))}
        </div>
    </div>
  );
};

const FriendsView: React.FC = () => (
  <div className="p-6 h-full bg-gray-50 pb-24">
    <h2 className="text-4xl font-black text-gray-900 mb-8 tracking-tight italic text-black uppercase">Vänner</h2>
    <div className="bg-white rounded-[3.5rem] p-12 border-4 border-gray-50 shadow-2xl text-center">
      <div className="w-28 h-28 bg-blue-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-6xl transform rotate-6 shadow-inner">🤝</div>
      <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight text-black">Vem vinner?</h3>
      <p className="text-gray-500 mb-12 font-bold text-lg leading-snug">Utmana dina vänner och se vem som har bäst koll i grannskapet.</p>
      <div className="space-y-4">
          <button className="w-full bg-[#1877F2] text-white font-black py-6 rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center space-x-3 text-lg"><span className="text-2xl font-bold">f</span><span>Logga in med Facebook</span></button>
          <button className="w-full bg-white text-gray-700 border-2 border-gray-200 font-black py-6 rounded-2xl shadow-lg active:scale-95 transition-transform text-lg text-gray-700">Logga in med Google</button>
      </div>
    </div>
  </div>
);

const CameraModal: React.FC<{ isOpen: boolean, onClose: () => void, onCapture: (img: string) => void }> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(err => {
          console.error("Camera error:", err);
          setHasPermission(false);
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
      canvasRef.current.width = size;
      canvasRef.current.height = size;
      
      const startX = (videoRef.current.videoWidth - size) / 2;
      const startY = (videoRef.current.videoHeight - size) / 2;

      context?.drawImage(videoRef.current, startX, startY, size, size, 0, 0, size, size);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg');
      onCapture(dataUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {!hasPermission ? (
          <div className="text-white p-10 text-center">
            <span className="text-6xl mb-4 block">🚫</span>
            <p className="font-bold text-xl">Kameran kunde inte startas. Kontrollera dina inställningar.</p>
            <button onClick={onClose} className="mt-6 bg-white text-black px-8 py-3 rounded-xl font-black">STÄNG</button>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 pointer-events-none border-[60px] border-black/50 flex items-center justify-center">
           <div className="w-64 h-64 border-4 border-white/50 rounded-[3rem]"></div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="bg-black p-10 flex justify-between items-center safe-area-bottom">
        <button onClick={onClose} className="text-white font-black uppercase text-xs tracking-widest px-4 py-2">Avbryt</button>
        <button onClick={capture} className="w-20 h-20 bg-white rounded-full border-8 border-gray-400 active:scale-90 transition-transform shadow-2xl"></button>
        <div className="w-16"></div> {/* Spacer */}
      </div>
    </div>
  );
};

const ProfileView: React.FC<{ totalScore: number, weeklyTrophies: string[], onStartWalk: () => void, isWalkActive: boolean, userName: string, profilePic: string, onUpdateProfile: (name: string, pic: string) => void }> = ({ totalScore, weeklyTrophies, onStartWalk, isWalkActive, userName, profilePic, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = [
    { label: 'Poäng totalt', value: totalScore + 154, icon: '⭐', color: 'text-blue-600', borderColor: 'border-blue-500' },
    { label: 'Walk Streak', value: '4 dagar', icon: '🔥', color: 'text-orange-500', borderColor: 'border-orange-500' },
    { label: 'Distans', value: '12.4 km', icon: '👣', color: 'text-green-600', borderColor: 'border-green-500' },
    { label: 'Snittpoäng', value: '7.8', icon: '📈', color: 'text-purple-600', borderColor: 'border-purple-500' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateProfile(userName, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = () => {
    onUpdateProfile(tempName, profilePic);
    setIsEditing(false);
  };

  return (
    <div className="p-6 h-full bg-gray-50 pb-32 animate-in fade-in duration-500">
        <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={(img) => onUpdateProfile(userName, img)} />
        
        <div className="flex flex-col items-center mb-12 mt-8">
            <div className="relative group">
                <div 
                  onClick={() => setIsEditing(true)}
                  className="w-44 h-44 rounded-[3.5rem] bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] border-8 border-white overflow-hidden flex items-center justify-center relative z-10 cursor-pointer group"
                >
                    <img src={profilePic} alt="User Avatar" className="w-full h-full object-cover transition-opacity group-hover:opacity-75" />
                    {!isEditing && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                      </div>
                    )}
                </div>
                <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-green-500 border-[6px] border-white rounded-full z-20 flex items-center justify-center shadow-2xl"><div className="w-4 h-4 bg-white rounded-full animate-pulse"></div></div>
            </div>

            {isEditing ? (
              <div className="mt-8 w-full max-w-xs flex flex-col items-center">
                <div className="flex space-x-4 mb-6 w-full">
                  <button onClick={() => setIsCameraOpen(true)} className="flex-1 bg-blue-50 text-blue-600 border-2 border-blue-100 font-black py-4 rounded-2xl flex flex-col items-center space-y-2 active:scale-95 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[10px] uppercase tracking-widest">Ta foto</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white text-gray-400 border-2 border-gray-100 font-black py-4 rounded-2xl flex flex-col items-center space-y-2 active:scale-95 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] uppercase tracking-widest">Galleri</span>
                  </button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                
                <input 
                  type="text" 
                  value={tempName} 
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Skriv namn..."
                  className="w-full bg-white border-4 border-blue-100 rounded-2xl px-6 py-4 text-2xl font-black text-center text-gray-900 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="flex space-x-3 mt-4 w-full">
                  <button onClick={saveProfile} className="flex-1 bg-green-500 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-transform uppercase text-xs">Spara</button>
                  <button onClick={() => { setTempName(userName); setIsEditing(false); }} className="flex-1 bg-gray-200 text-gray-600 font-black py-4 rounded-xl shadow-md active:scale-95 transition-transform uppercase text-xs">Avbryt</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center group cursor-pointer" onClick={() => setIsEditing(true)}>
                <div className="flex items-center space-x-3 mt-8">
                  <h3 className="text-4xl font-black text-gray-900 leading-none tracking-tighter text-black">{userName}</h3>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <span className="text-[12px] font-black uppercase text-blue-500 tracking-[0.4em] mt-4 bg-blue-50 px-6 py-2 rounded-full border border-blue-100 shadow-sm text-blue-500">ELITE MEMBER</span>
              </div>
            )}
        </div>

        <div className="mb-14">
          <button 
            onClick={onStartWalk}
            className={`w-full py-10 rounded-[3.5rem] font-black text-3xl shadow-[0_15px_0_rgb(21,128,61)] active:shadow-none active:translate-y-2 transform transition-all flex items-center justify-center space-x-6 uppercase ${isWalkActive ? 'bg-orange-500 shadow-[0_15px_0_rgb(194,65,12)] text-white' : 'bg-green-500 text-white'}`}
          >
            <span className="text-5xl">{isWalkActive ? '🗺️' : '👟'}</span>
            <span>{isWalkActive ? 'Fortsätt' : 'Starta'}</span>
          </button>
          <p className="text-center text-[12px] font-black text-gray-400 uppercase tracking-[0.3em] mt-6 leading-none">Vecka {getWeekNumber(new Date())} • 10 nya frågor redo</p>
        </div>

        <h4 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.4em] mb-6 ml-4">Mina Troféer</h4>
        <div className="bg-white rounded-[3rem] p-8 shadow-sm mb-12 flex space-x-5 overflow-x-auto no-scrollbar border border-gray-50">
          {['V1', 'V2', 'V3', 'V4', 'V5', 'V6'].map((week) => (
            <div key={week} className={`flex-shrink-0 w-20 h-24 rounded-3xl flex flex-col items-center justify-center border-4 ${weeklyTrophies.includes(week) ? 'bg-yellow-50 border-yellow-100 shadow-md' : 'bg-gray-50 border-gray-100 opacity-20'}`}>
              <span className="text-4xl mb-2">{weeklyTrophies.includes(week) ? '🏆' : '🔒'}</span>
              <span className="text-[12px] font-black text-gray-600 uppercase tracking-tighter text-gray-600">{week}</span>
            </div>
          ))}
        </div>

        <h4 className="text-[12px] font-black text-gray-400 uppercase tracking-[0.4em] mb-6 ml-4">Min Statistik</h4>
        <div className="grid grid-cols-2 gap-6 mb-12">
            {stats.map((stat, i) => (
                <div key={i} className={`bg-white p-8 rounded-[3rem] shadow-sm border-b-[10px] ${stat.borderColor} active:scale-95 transition-transform border border-gray-50`}>
                    <div className="text-4xl mb-4">{stat.icon}</div>
                    <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none text-gray-400">{stat.label}</p>
                    <p className={`text-3xl font-black ${stat.color} leading-none tracking-tight`}>{stat.value}</p>
                </div>
            ))}
        </div>
        <button className="w-full py-8 text-red-500 font-black text-sm uppercase tracking-[0.5em] opacity-30 hover:opacity-100 transition-opacity">Logga ut</button>
    </div>
  );
};

export default App;
