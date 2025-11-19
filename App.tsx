import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, loginTeacher, registerTeacher, logout, ref, onValue, push, set, update, get } from './services/firebase';
import { UserRole, StudentProfile, TeacherProfile, PaymentStatus, PaymentRecord } from './types';
import { 
  Users, MessageSquare, ClipboardList, Wallet, LogOut, UserCheck, 
  Check, X, AlertTriangle, Lock, User, Search, Star, 
  Calendar, Plus, ShieldAlert, Ban, RefreshCw, Bell, History, ChevronLeft,
  LayoutDashboard, GraduationCap, TrendingUp, DollarSign
} from 'lucide-react';
import Chat from './components/Chat';
import Exams from './components/Exams';

// --- Main Component ---

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [view, setView] = useState('dashboard'); 
  
  // Teacher Auth State
  const [isRegistering, setIsRegistering] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherName, setTeacherName] = useState('');

  // Student Login State
  const [studentName, setStudentName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [teachersList, setTeachersList] = useState<TeacherProfile[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);

  // Teacher Dashboard Data
  const [myStudents, setMyStudents] = useState<StudentProfile[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceHistory, setAttendanceHistory] = useState<Record<string, Record<string, { status: string }>>>({});

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [requestingReview, setRequestingReview] = useState(false);
  const [viewingPaymentHistory, setViewingPaymentHistory] = useState<StudentProfile | null>(null);

  // Check Auth State
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        setRole(UserRole.TEACHER);
        localStorage.removeItem('nizam_teacher_mock');
      } else {
        const savedMockTeacher = localStorage.getItem('nizam_teacher_mock');
        if (savedMockTeacher) {
          setUser(JSON.parse(savedMockTeacher));
          setRole(UserRole.TEACHER);
          return;
        }

        const savedStudent = localStorage.getItem('nizam_student');
        if (savedStudent) {
          const studentData = JSON.parse(savedStudent);
          setStudentProfile(studentData);
          setRole(UserRole.STUDENT);
          setSelectedTeacherId(studentData.teacherId);
        } else {
          setUser(null);
          setRole(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Load Teachers for Student Login
  useEffect(() => {
    if (!user && !role) {
      const teachersRef = ref(db, 'teachers');
      onValue(teachersRef, (snapshot: any) => {
        const data = snapshot.val();
        if (data) {
          setTeachersList(Object.values(data));
        }
      });
    }
  }, [user, role]);

  // Load Data for Teacher
  useEffect(() => {
    if (user && role === UserRole.TEACHER) {
      const studentsRef = ref(db, `students/${user.uid}`);
      onValue(studentsRef, (snapshot: any) => {
        const data = snapshot.val();
        if (data) setMyStudents(Object.values(data));
        else setMyStudents([]);
      });

      const attRef = ref(db, `attendance/${user.uid}`);
      onValue(attRef, (snapshot: any) => {
        const data = snapshot.val();
        if (data) setAttendanceHistory(data);
        else setAttendanceHistory({});
      });
    }
  }, [user, role]);

  // Load Data for Student Dashboard
  useEffect(() => {
    if (role === UserRole.STUDENT && studentProfile) {
       const profileRef = ref(db, `students/${studentProfile.teacherId}/${studentProfile.id}`);
       onValue(profileRef, (snapshot: any) => {
           if (snapshot.exists()) {
               const updated = snapshot.val();
               setStudentProfile(updated);
               const currentLocal = JSON.parse(localStorage.getItem('nizam_student') || '{}');
               localStorage.setItem('nizam_student', JSON.stringify({ ...currentLocal, ...updated }));
           }
       });
    }
  }, [role, studentProfile?.teacherId, studentProfile?.id]);

  // --- ACTIONS ---

  const handleTeacherAuth = async () => {
    if (!teacherEmail || !teacherPassword) return alert("يرجى إدخال البيانات");
    try {
      let loggedInUser;
      if (isRegistering) {
        loggedInUser = await registerTeacher(teacherEmail, teacherPassword, teacherName);
      } else {
        loggedInUser = await loginTeacher(teacherEmail, teacherPassword);
      }
      if (loggedInUser) {
        setUser(loggedInUser);
        setRole(UserRole.TEACHER);
        if ((loggedInUser as any).isAnonymous) {
           localStorage.setItem('nizam_teacher_mock', JSON.stringify(loggedInUser));
        }
        setView('dashboard');
      }
    } catch (error: any) {
      console.error(error);
      alert("فشل تسجيل الدخول");
    }
  };

  const handleStudentLogin = async () => {
    if (!studentName || !selectedTeacherId || !activationCode) return alert("يرجى ملء جميع البيانات");
    try {
      const studentsRef = ref(db, `students/${selectedTeacherId}`);
      const snapshot = await get(studentsRef);
      let found = false;
      if (snapshot.exists()) {
        snapshot.forEach((child: any) => {
          const s: StudentProfile = child.val();
          if (s.code === activationCode) {
            found = true;
            if (s.name !== studentName) {
              update(ref(db, `students/${selectedTeacherId}/${s.id}`), { name: studentName });
            }
            setStudentProfile({ ...s, name: studentName });
            setRole(UserRole.STUDENT);
            localStorage.setItem('nizam_student', JSON.stringify({ ...s, name: studentName }));
            setView('exams');
          }
        });
      }
      if (!found) alert("كود التفعيل غير صحيح");
    } catch (e) {
      console.error(e);
      alert("حدث خطأ");
    }
  };

  const createStudent = async () => {
    if (!user) return;
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newRef = push(ref(db, `students/${user.uid}`));
    const newStudent: StudentProfile = {
      id: newRef.key!,
      name: 'طالب جديد',
      teacherId: user.uid,
      code: newCode,
      hasPaid: false,
      paymentStatus: 'unpaid',
      rating: 0
    };
    await set(newRef, newStudent);
  };

  const updatePaymentStatus = async (s: StudentProfile, status: PaymentStatus) => {
    if (!user) return;
    
    // If confirming payment, log to history
    if (status === 'paid' && s.paymentStatus !== 'paid') {
        const historyItem: PaymentRecord = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            timestamp: Date.now(),
            adminName: user.displayName,
            status: 'paid'
        };
        await push(ref(db, `students/${user.uid}/${s.id}/paymentHistory`), historyItem);
    }

    const updates: any = { paymentStatus: status, hasPaid: status === 'paid' };
    if (status === 'paid') {
        updates.reviewRequested = false;
    }
    await update(ref(db, `students/${user.uid}/${s.id}`), updates);
  };

  const updateRating = async (s: StudentProfile, newRating: number) => {
    if (!user) return;
    await update(ref(db, `students/${user.uid}/${s.id}`), { rating: newRating });
  };

  const markAttendance = async (studentId: string, status: 'present' | 'absent') => {
    if (!user) return;
    await set(ref(db, `attendance/${user.uid}/${attendanceDate}/${studentId}`), { status });
  };

  const studentRequestReview = async () => {
    if (!studentProfile) return;
    setRequestingReview(true);
    try {
        await update(ref(db, `students/${studentProfile.teacherId}/${studentProfile.id}`), { reviewRequested: true });
        alert("تم إرسال الطلب للأستاذ للمراجعة");
    } catch (e) {
        alert("حدث خطأ");
    }
    setRequestingReview(false);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('nizam_teacher_mock');
    localStorage.removeItem('nizam_student');
    setUser(null);
    setRole(null);
    setStudentProfile(null);
    window.location.reload();
  };

  const filteredStudents = useMemo(() => {
    return myStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [myStudents, searchTerm]);

  const reviewRequestsCount = useMemo(() => {
    return myStudents.filter(s => s.reviewRequested).length;
  }, [myStudents]);

  const stats = useMemo(() => {
      const total = myStudents.length;
      const paid = myStudents.filter(s => s.paymentStatus === 'paid' || s.hasPaid).length;
      const locked = myStudents.filter(s => s.paymentStatus === 'locked').length;
      const presentToday = Object.values(attendanceHistory[attendanceDate] || {}).filter((r:any) => r.status === 'present').length;
      
      return { total, paid, locked, presentToday };
  }, [myStudents, attendanceHistory, attendanceDate]);

  // --- MODALS & SCREENS ---

  const PaymentHistoryModal = () => {
    if (!viewingPaymentHistory) return null;
    const history = viewingPaymentHistory.paymentHistory ? (Object.values(viewingPaymentHistory.paymentHistory) as PaymentRecord[]).sort((a,b) => b.timestamp - a.timestamp) : [];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingPaymentHistory(null)}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-white/20 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-3"><History size={20}/> سجل مدفوعات: {viewingPaymentHistory.name}</h3>
                    <button onClick={() => setViewingPaymentHistory(null)} className="hover:bg-white/10 p-1 rounded-full transition"><X size={24}/></button>
                </div>
                <div className="p-0 max-h-96 overflow-y-auto bg-gray-50">
                    {history.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Wallet size={48} className="mx-auto mb-4 opacity-20"/>
                            <p className="font-medium">لا يوجد سجل مدفوعات سابق</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-100 text-gray-500 sticky top-0 border-b border-gray-200">
                                <tr>
                                    <th className="p-4 font-bold">التاريخ</th>
                                    <th className="p-4 font-bold">الحالة</th>
                                    <th className="p-4 font-bold">المسؤول</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map(rec => (
                                    <tr key={rec.id} className="hover:bg-white transition">
                                        <td className="p-4 text-gray-800 font-mono dir-ltr text-right">{new Date(rec.timestamp).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-4"><span className="text-emerald-700 font-bold text-xs bg-emerald-100 px-3 py-1 rounded-full shadow-sm">تم الدفع</span></td>
                                        <td className="p-4 text-gray-600 font-medium">{rec.adminName}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
  };

  // Login Screen
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary rounded-full blur-[128px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary rounded-full blur-[128px]"></div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 w-full max-w-md border border-white/10 z-10">
          <div className="text-center mb-10">
             <div className="w-20 h-20 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-primary/40 ring-4 ring-white/5">
                <GraduationCap className="text-white" size={40} />
             </div>
             <h1 className="text-5xl font-extrabold text-white mb-2 tracking-tight font-sans">نِظَام</h1>
             <p className="text-indigo-200 text-base font-medium tracking-wide">إدارة تعليمية متكاملة</p>
          </div>
          
          <div className="space-y-8">
            <div className="bg-white/5 rounded-3xl p-2 border border-white/5">
                <div className="flex p-1 bg-black/20 rounded-2xl mb-6 backdrop-blur-sm">
                    <button 
                        onClick={() => setIsRegistering(false)} 
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${!isRegistering ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}
                    >
                        تسجيل دخول
                    </button>
                    <button 
                        onClick={() => setIsRegistering(true)} 
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isRegistering ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-white'}`}
                    >
                        حساب جديد
                    </button>
                </div>
                
                <div className="px-4 pb-4 space-y-4">
                   <div className="text-center mb-6">
                      <h2 className="font-bold text-white text-lg flex items-center justify-center gap-2">
                        <User size={20} className="text-primary"/> 
                        {isRegistering ? 'بيانات المعلم الجديد' : 'بوابة المعلمين'}
                      </h2>
                   </div>
                   {isRegistering && (
                      <input 
                        type="text" placeholder="الاسم الكامل" value={teacherName} onChange={(e) => setTeacherName(e.target.value)}
                        className="w-full p-4 border border-white/10 rounded-2xl bg-white/5 focus:bg-white/10 focus:border-primary/50 outline-none text-right text-white placeholder-gray-500 transition"
                      />
                   )}
                   <input 
                      type="email" placeholder="البريد الإلكتروني" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)}
                      className="w-full p-4 border border-white/10 rounded-2xl bg-white/5 focus:bg-white/10 focus:border-primary/50 outline-none text-right text-white placeholder-gray-500 transition"
                   />
                   <input 
                      type="password" placeholder="كلمة المرور" value={teacherPassword} onChange={(e) => setTeacherPassword(e.target.value)}
                      className="w-full p-4 border border-white/10 rounded-2xl bg-white/5 focus:bg-white/10 focus:border-primary/50 outline-none text-right text-white placeholder-gray-500 transition"
                   />
                   <button onClick={handleTeacherAuth} className="w-full bg-gradient-to-r from-primary to-indigo-600 text-white py-4 rounded-2xl hover:shadow-lg hover:shadow-primary/40 transition font-bold text-lg active:scale-95 transform">
                      {isRegistering ? 'إنشاء الحساب وبدء العمل' : 'الدخول للوحة التحكم'}
                   </button>
                </div>
            </div>

            <div className="bg-indigo-500/10 rounded-3xl p-6 border border-indigo-500/20 hover:bg-indigo-500/20 transition">
                <h2 className="text-center font-bold text-indigo-200 mb-6 flex items-center justify-center gap-2 text-lg">
                    <Users size={20} className="text-indigo-300"/> تسجيل دخول الطلاب
                </h2>
                <div className="space-y-4">
                    <select 
                        className="w-full p-4 border border-white/10 rounded-2xl bg-black/20 focus:bg-black/40 focus:border-indigo-400/50 outline-none text-right text-white appearance-none cursor-pointer"
                        value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)}
                    >
                        <option value="" className="text-gray-900">اختر المعلم من القائمة...</option>
                        {teachersList.map(t => <option key={t.uid} value={t.uid} className="text-gray-900">{t.displayName}</option>)}
                    </select>
                    <input 
                        type="text" placeholder="اسم الطالب الثلاثي" value={studentName} onChange={(e) => setStudentName(e.target.value)}
                        className="w-full p-4 border border-white/10 rounded-2xl bg-black/20 focus:bg-black/40 focus:border-indigo-400/50 outline-none text-right text-white placeholder-gray-500 transition"
                    />
                    <input 
                        type="text" placeholder="كود التفعيل الخاص بك" value={activationCode} onChange={(e) => setActivationCode(e.target.value)}
                        className="w-full p-4 border border-white/10 rounded-2xl bg-black/20 focus:bg-black/40 focus:border-indigo-400/50 outline-none text-right text-white placeholder-gray-500 transition font-mono tracking-widest text-center"
                    />
                    <button onClick={handleStudentLogin} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl hover:shadow-lg hover:shadow-emerald-500/30 transition font-bold text-lg active:scale-95 transform">
                        تسجيل الدخول
                    </button>
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Locked Student View
  if (role === UserRole.STUDENT && studentProfile?.paymentStatus === 'locked') {
     return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/40 to-slate-900 z-0"></div>
            <div className="z-10 bg-white/10 backdrop-blur-xl rounded-[2rem] p-12 shadow-2xl max-w-lg w-full border border-white/10 relative">
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-red-500 rounded-3xl rotate-45 flex items-center justify-center shadow-2xl shadow-red-500/50 border-4 border-slate-900">
                    <Lock className="text-white -rotate-45" size={40} />
                </div>
                <h1 className="text-4xl font-bold text-white mb-4 mt-8">الحساب مغلق</h1>
                <div className="bg-red-500/10 rounded-xl p-4 mb-8 border border-red-500/20">
                   <p className="text-red-200 text-lg font-medium">
                       أهلاً {studentProfile.name}، نعتذر منك ولكن تم إيقاف الحساب مؤقتاً لعدم سداد المصروفات.
                   </p>
                </div>
                
                <button 
                    onClick={studentRequestReview}
                    disabled={studentProfile.reviewRequested || requestingReview}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition flex items-center justify-center gap-3 mb-6
                    ${studentProfile.reviewRequested 
                        ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg hover:shadow-indigo-500/50 hover:scale-[1.02] transform'}`}
                >
                    {studentProfile.reviewRequested ? <><RefreshCw className="animate-spin" size={24} /> تم إرسال الطلب للمراجعة</> : <><Check size={24} /> لقد قمت بالدفع، أعد التفعيل</>}
                </button>
                <button onClick={handleLogout} className="text-slate-400 hover:text-white transition text-sm font-medium">تسجيل خروج آمن</button>
            </div>
        </div>
     );
  }

  // --- AUTHENTICATED MAIN LAYOUT ---

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden" dir="rtl">
      <PaymentHistoryModal />
      
      {/* --- PROFESSIONAL SIDEBAR (DARK) --- */}
      <aside className="bg-slate-900 w-full md:w-72 flex flex-col shrink-0 z-30 shadow-2xl">
        {/* Sidebar Header */}
        <div className="p-6 flex flex-col items-center bg-slate-950/50 border-b border-slate-800">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-20 h-20 rounded-full bg-slate-900 p-1">
                <img 
                  src={role === UserRole.TEACHER ? user.photoURL : `https://api.dicebear.com/9.x/avataaars/svg?seed=${studentProfile?.name}`} 
                  alt="profile" className="w-full h-full object-cover rounded-full"
                />
            </div>
          </div>
          <h2 className="font-bold text-lg text-white mt-4 text-center">{role === UserRole.TEACHER ? user.displayName : studentProfile?.name}</h2>
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase mt-1">{role === UserRole.TEACHER ? 'Admin / Teacher' : 'Student Portal'}</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
          {role === UserRole.TEACHER ? (
            <>
              {[
                  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
                  { id: 'students', label: 'إدارة الطلاب', icon: Users },
                  { id: 'attendance', label: 'سجل الحضور', icon: UserCheck },
                  { id: 'payments', label: 'المالية', icon: Wallet, alert: reviewRequestsCount > 0 },
                  { id: 'exams', label: 'الامتحانات', icon: ClipboardList },
                  { id: 'chat', label: 'غرفة التواصل', icon: MessageSquare },
              ].map(item => (
                <button 
                  key={item.id} onClick={() => setView(item.id)} 
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-300 group relative overflow-hidden
                  ${view === item.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <item.icon size={22} className={`transition-transform duration-300 ${view === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="relative z-10">{item.label}</span>
                  {item.alert && (
                     <span className="absolute left-4 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                     </span>
                  )}
                </button>
              ))}
            </>
          ) : (
            <>
                <button onClick={() => setView('exams')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all ${view === 'exams' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <ClipboardList size={22} /> <span>الامتحانات والواجبات</span>
                </button>
                <button onClick={() => setView('chat')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all ${view === 'chat' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <MessageSquare size={22} /> <span>تواصل مع المعلم</span>
                </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-3 text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-300 font-bold group">
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform"/> <span>تسجيل خروج</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-y-auto h-screen bg-gray-50 relative">
        {/* Top decorative bar */}
        <div className="h-48 bg-gradient-to-r from-slate-900 to-indigo-900 absolute top-0 left-0 right-0 z-0"></div>
        
        <div className="relative z-10 p-6 md:p-10 max-w-7xl mx-auto">
            
            {/* Header Greeting */}
            <div className="mb-8 text-white flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-1">مرحباً، {role === UserRole.TEACHER ? user?.displayName?.split(' ')[0] : studentProfile?.name.split(' ')[0]} 👋</h1>
                    <p className="text-indigo-200 text-sm opacity-80">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                {role === UserRole.STUDENT && (
                    <div className={`px-4 py-2 rounded-full font-bold text-sm backdrop-blur-md bg-white/20 border border-white/20 flex items-center gap-2 ${studentProfile?.paymentStatus === 'paid' || studentProfile?.hasPaid ? 'text-emerald-300' : 'text-red-300'}`}>
                        <Wallet size={16}/> {studentProfile?.paymentStatus === 'paid' || studentProfile?.hasPaid ? 'حساب مفعل' : 'اشتراك غير مدفوع'}
                    </div>
                )}
            </div>

            {/* --- TEACHER DASHBOARD WIDGETS --- */}
            {role === UserRole.TEACHER && view === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Widget 1 */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg shadow-indigo-100 border border-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8"></div>
                            <div className="relative">
                                <p className="text-gray-500 text-sm font-bold mb-2">إجمالي الطلاب</p>
                                <h3 className="text-4xl font-bold text-gray-800 mb-2">{stats.total}</h3>
                                <div className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-50 w-fit px-2 py-1 rounded-full">
                                    <TrendingUp size={12}/> نشطين
                                </div>
                            </div>
                            <div className="absolute left-6 top-6 p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-300">
                                <Users size={24}/>
                            </div>
                        </div>
                        {/* Widget 2 */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg shadow-emerald-100 border border-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-8 -mt-8"></div>
                            <div className="relative">
                                <p className="text-gray-500 text-sm font-bold mb-2">المدفوعات هذا الشهر</p>
                                <h3 className="text-4xl font-bold text-gray-800 mb-2">{stats.paid} <span className="text-lg text-gray-400">/ {stats.total}</span></h3>
                                <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{width: `${(stats.paid / (stats.total || 1)) * 100}%`}}></div>
                                </div>
                            </div>
                            <div className="absolute left-6 top-6 p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-300">
                                <DollarSign size={24}/>
                            </div>
                        </div>
                        {/* Widget 3 */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg shadow-blue-100 border border-white relative overflow-hidden">
                             <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8"></div>
                             <div className="relative">
                                <p className="text-gray-500 text-sm font-bold mb-2">الحضور اليوم</p>
                                <h3 className="text-4xl font-bold text-gray-800 mb-2">{stats.presentToday}</h3>
                                <p className="text-xs text-gray-400">بتاريخ {attendanceDate}</p>
                            </div>
                            <div className="absolute left-6 top-6 p-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-300">
                                <UserCheck size={24}/>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Bell className="text-primary" size={20}/> تنبيهات سريعة</h3>
                            {stats.locked > 0 ? (
                                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3 text-red-700 font-medium mb-3">
                                    <Ban size={20} />
                                    <span>هناك {stats.locked} طلاب تم إغلاق حساباتهم مؤقتاً.</span>
                                </div>
                            ) : (
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3 text-green-700 font-medium mb-3">
                                    <Check size={20} />
                                    <span>لا توجد حسابات مغلقة حالياً.</span>
                                </div>
                            )}
                             {reviewRequestsCount > 0 && (
                                <button onClick={() => setView('payments')} className="w-full p-4 bg-yellow-50 rounded-xl border border-yellow-100 flex items-center justify-between text-yellow-700 font-medium hover:bg-yellow-100 transition">
                                    <span className="flex items-center gap-3"><AlertTriangle size={20} /> {reviewRequestsCount} طلبات مراجعة دفع معلقة</span>
                                    <ChevronLeft size={18} />
                                </button>
                            )}
                        </div>
                         <div className="bg-gradient-to-br from-slate-900 to-indigo-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-bold text-xl mb-4">روابط سريعة</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => setView('students')} className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl text-sm font-bold transition flex flex-col items-center gap-2">
                                        <Plus size={24} className="text-emerald-400"/> إضافة طالب
                                    </button>
                                    <button onClick={() => setView('exams')} className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl text-sm font-bold transition flex flex-col items-center gap-2">
                                        <ClipboardList size={24} className="text-blue-400"/> امتحان جديد
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- STUDENTS LIST (PRO DESIGN) --- */}
            {role === UserRole.TEACHER && view === 'students' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute right-5 top-4 text-gray-400" size={20} />
                                <input 
                                type="text" placeholder="ابحث عن طالب بالاسم..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pr-14 pl-6 py-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition font-medium text-gray-700"
                                />
                            </div>
                            <button onClick={createStudent} className="bg-slate-900 text-white px-8 py-4 rounded-2xl hover:bg-black transition flex items-center gap-3 shadow-lg shadow-slate-500/20 font-bold whitespace-nowrap transform active:scale-95">
                                <Plus size={20} /> طالب جديد
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredStudents.map(student => (
                            <div key={student.id} className="group bg-white rounded-3xl p-6 shadow-sm hover:shadow-2xl border border-gray-100 hover:border-indigo-100 transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-gray-50 to-white z-0"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full p-1.5 bg-white shadow-lg mb-4 relative group-hover:scale-105 transition-transform">
                                        <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${student.name}`} alt="avatar" className="w-full h-full rounded-full bg-gray-100" />
                                        <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-white ${student.paymentStatus === 'paid' || student.hasPaid ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                    </div>
                                    <input 
                                        className="text-center font-bold text-xl text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary outline-none w-full mb-1 transition"
                                        defaultValue={student.name} onBlur={(e) => update(ref(db, `students/${user.uid}/${student.id}`), { name: e.target.value })}
                                    />
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-3 py-1 rounded-full tracking-wider">#{student.code}</span>
                                    </div>

                                    <div className="w-full flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl mb-4 border border-gray-50">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">التقييم</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button key={star} onClick={() => updateRating(student, star)} className="hover:scale-110 transition">
                                                <Star size={18} className={star <= student.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 hover:text-yellow-300"} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="w-full flex gap-2">
                                        <div className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold ${
                                            student.paymentStatus === 'paid' || student.hasPaid 
                                            ? 'bg-emerald-50 text-emerald-600' 
                                            : student.paymentStatus === 'locked' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {student.paymentStatus === 'paid' || student.hasPaid ? <Check size={16}/> : student.paymentStatus === 'locked' ? <Lock size={16}/> : <AlertTriangle size={16}/>}
                                            {student.paymentStatus === 'paid' || student.hasPaid ? 'مدفوع' : 'غير مدفوع'}
                                        </div>
                                        <button onClick={() => setView('payments')} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition">
                                            <Wallet size={18}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- PAYMENT TABLE (PRO DESIGN) --- */}
            {role === UserRole.TEACHER && view === 'payments' && (
                <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">الرقابة المالية</h2>
                            <p className="text-gray-500 text-sm mt-1">متابعة الاشتراكات الشهرية وتجديد الحسابات</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 shadow-sm">
                                {filteredStudents.length} طلاب
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50/50 text-gray-400 text-xs uppercase tracking-wider font-bold">
                                <tr>
                                    <th className="p-6">معلومات الطالب</th>
                                    <th className="p-6">حالة الاشتراك</th>
                                    <th className="p-6">الإجراء السريع</th>
                                    <th className="p-6">التحكم بالحساب</th>
                                    <th className="p-6">السجل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className={`group hover:bg-blue-50/30 transition-colors ${student.reviewRequested ? 'bg-yellow-50/40' : ''}`}>
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gray-100">
                                                    <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${student.name}`} alt="" className="w-full h-full rounded-full"/>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{student.name}</div>
                                                    {student.reviewRequested && (
                                                        <div className="flex items-center gap-1 text-yellow-600 text-[10px] font-bold mt-1 animate-pulse">
                                                            <RefreshCw size={10} className="animate-spin"/> يطلب المراجعة
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            {student.paymentStatus === 'locked' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div> مغلق
                                                </span>
                                            ) : student.paymentStatus === 'warned' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-600 text-xs font-bold border border-yellow-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-600"></div> منذر
                                                </span>
                                            ) : student.paymentStatus === 'paid' || student.hasPaid ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div> نشط
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div> غير مدفوع
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-6">
                                            {student.paymentStatus !== 'paid' && !student.hasPaid ? (
                                                <button onClick={() => updatePaymentStatus(student, 'paid')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-black transition flex items-center gap-2 text-xs font-bold shadow-lg shadow-slate-200 transform active:scale-95">
                                                    <Check size={14} /> تأكيد السداد
                                                </button>
                                            ) : (
                                                <button onClick={() => updatePaymentStatus(student, 'unpaid')} className="text-gray-400 hover:text-red-500 text-xs font-bold px-2 transition-colors">
                                                    إلغاء الاشتراك
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => updatePaymentStatus(student, 'warned')} className="p-2.5 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-xl transition" title="إرسال إنذار">
                                                    <ShieldAlert size={18} />
                                                </button>
                                                <button onClick={() => updatePaymentStatus(student, 'locked')} className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition" title="قفل الحساب">
                                                    <Ban size={18} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <button onClick={() => setViewingPaymentHistory(student)} className="text-indigo-600 hover:bg-indigo-50 p-2.5 rounded-xl transition">
                                                <History size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- ATTENDANCE VIEW --- */}
            {role === UserRole.TEACHER && view === 'attendance' && (
                <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">دفتر الحضور</h2>
                            <p className="text-gray-500 mt-1">إدارة الحضور والغياب اليومي</p>
                        </div>
                        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                             <button onClick={() => {
                                 const d = new Date(attendanceDate);
                                 d.setDate(d.getDate() - 1);
                                 setAttendanceDate(d.toISOString().split('T')[0]);
                             }} className="p-2 hover:bg-white rounded-xl transition shadow-sm"><ChevronLeft className="rotate-180" size={20}/></button>
                             
                             <input 
                                type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 outline-none font-bold text-gray-700"
                            />

                            <button onClick={() => {
                                 const d = new Date(attendanceDate);
                                 d.setDate(d.getDate() + 1);
                                 setAttendanceDate(d.toISOString().split('T')[0]);
                             }} className="p-2 hover:bg-white rounded-xl transition shadow-sm"><ChevronLeft size={20}/></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myStudents.map(student => {
                            const status = attendanceHistory[attendanceDate]?.[student.id]?.status;
                            return (
                            <div key={student.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-200 ${status === 'present' ? 'bg-emerald-50/50 border-emerald-100' : status === 'absent' ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${status === 'present' ? 'bg-emerald-500' : status === 'absent' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                    <div className="font-bold text-gray-700">{student.name}</div>
                                </div>
                                <div className="flex gap-2">
                                <button onClick={() => markAttendance(student.id, 'present')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${status === 'present' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-110' : 'bg-white text-gray-300 hover:text-emerald-500 border border-gray-100'}`}>
                                    <Check size={20} />
                                </button>
                                <button onClick={() => markAttendance(student.id, 'absent')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${status === 'absent' ? 'bg-red-500 text-white shadow-lg shadow-red-200 scale-110' : 'bg-white text-gray-300 hover:text-red-500 border border-gray-100'}`}>
                                    <X size={20} />
                                </button>
                                </div>
                            </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* --- STUDENT DASHBOARD STATS --- */}
            {role === UserRole.STUDENT && view === 'exams' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4">
                     <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-1 rounded-3xl shadow-lg shadow-orange-200">
                         <div className="bg-white h-full rounded-[20px] p-6 flex items-center justify-between relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-orange-900/50 text-xs font-bold uppercase tracking-wider mb-2">التقييم العام</p>
                                <div className="flex gap-1.5">
                                    {[1,2,3,4,5].map(star => (
                                        <Star key={star} size={26} className={`drop-shadow-sm ${star <= (studentProfile?.rating || 0) ? "fill-orange-400 text-orange-400" : "text-gray-200"}`} />
                                    ))}
                                </div>
                                <p className="mt-3 text-sm font-bold text-gray-500">ممتاز، استمر في التقدم!</p>
                            </div>
                            <div className="w-20 h-20 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 rotate-3">
                                <Star size={36} className="fill-current" />
                            </div>
                         </div>
                     </div>
                     
                     <div className={`p-1 rounded-3xl shadow-lg ${studentProfile?.paymentStatus === 'paid' || studentProfile?.hasPaid ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-200' : 'bg-gradient-to-br from-red-400 to-pink-500 shadow-red-200'}`}>
                         <div className="bg-white h-full rounded-[20px] p-6 flex items-center justify-between relative overflow-hidden">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">حالة الاشتراك</p>
                                <p className={`font-bold text-2xl ${studentProfile?.paymentStatus === 'paid' || studentProfile?.hasPaid ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {studentProfile?.paymentStatus === 'paid' || studentProfile?.hasPaid ? 'الاشتراك مفعل' : 'يرجى السداد'}
                                </p>
                            </div>
                            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center -rotate-3 ${studentProfile?.paymentStatus === 'paid' || studentProfile?.hasPaid ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                                {studentProfile?.paymentStatus === 'paid' || studentProfile?.hasPaid ? <Check size={36} /> : <Wallet size={36} />}
                            </div>
                         </div>
                     </div>
                 </div>
            )}

            {/* Shared Views Content */}
            {view === 'chat' && (
                <div className="h-[calc(100vh-200px)] animate-in fade-in zoom-in-95 duration-300">
                    <Chat 
                        teacherId={role === UserRole.TEACHER ? user.uid : studentProfile!.teacherId}
                        currentUserId={role === UserRole.TEACHER ? user.uid : studentProfile!.id}
                        currentUserName={role === UserRole.TEACHER ? user.displayName : studentProfile!.name}
                        role={role!}
                    />
                </div>
            )}

            {view === 'exams' && (
                 <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <Exams 
                        teacherId={role === UserRole.TEACHER ? user.uid : studentProfile!.teacherId}
                        role={role!}
                        studentId={role === UserRole.STUDENT ? studentProfile!.id : undefined}
                        studentName={role === UserRole.STUDENT ? studentProfile!.name : undefined}
                    />
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default App;