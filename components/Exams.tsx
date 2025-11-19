import React, { useState, useEffect } from 'react';
import { db, ref, onValue, push, set, get, update } from '../services/firebase';
import { Exam, Question, UserRole, ExamSubmission } from '../types';
import { Plus, CheckCircle, Clock, BookOpen, Trash2, Save, Check, X, List, AlignLeft, Edit3, ArrowRight, ChevronDown, FileText } from 'lucide-react';

interface ExamsProps {
  teacherId: string;
  role: UserRole;
  studentId?: string;
  studentName?: string;
}

const Exams: React.FC<ExamsProps> = ({ teacherId, role, studentId, studentName }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'take' | 'results' | 'grading'>('list');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<Record<string, ExamSubmission>>({});
  
  // Creation State
  const [newExamTitle, setNewExamTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Question Builder State
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<'multiple_choice' | 'essay'>('multiple_choice');
  const [qPoints, setQPoints] = useState(5);
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectIdx, setQCorrectIdx] = useState<number>(0);

  // Taking State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // Grading State
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<ExamSubmission | null>(null);
  const [gradingScore, setGradingScore] = useState(0);

  useEffect(() => {
    const examsRef = ref(db, `exams/${teacherId}`);
    onValue(examsRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        setExams(Object.values(data));
      } else {
        setExams([]);
      }
    });
  }, [teacherId]);

  // Load Student Submissions status
  useEffect(() => {
    if (role === UserRole.STUDENT && studentId && exams.length > 0) {
      exams.forEach(exam => {
        const subRef = ref(db, `submissions/${exam.id}/${studentId}`);
        onValue(subRef, (snapshot: any) => {
          if (snapshot.exists()) {
            setStudentSubmissions(prev => ({
              ...prev,
              [exam.id]: snapshot.val()
            }));
          }
        });
      });
    }
  }, [role, studentId, exams]);

  // --- Creation Logic ---

  const addQuestion = () => {
    if (!qText) return alert("الرجاء كتابة نص السؤال");
    if (qType === 'multiple_choice' && qOptions.some(o => !o.trim())) return alert("الرجاء ملء جميع الاختيارات");

    const newQ: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: qText,
      type: qType,
      points: qPoints,
      options: qType === 'multiple_choice' ? qOptions : undefined,
      correctAnswer: qType === 'multiple_choice' ? qOptions[qCorrectIdx] : undefined
    };

    setQuestions([...questions, newQ]);
    setQText('');
    setQOptions(['', '', '', '']);
    setQCorrectIdx(0);
  };

  const deleteQuestion = (idx: number) => {
    const updated = [...questions];
    updated.splice(idx, 1);
    setQuestions(updated);
  };

  const saveExam = async () => {
    if (!newExamTitle || questions.length === 0) return alert("الرجاء إضافة عنوان وأسئلة للامتحان");
    const newRef = push(ref(db, `exams/${teacherId}`));
    const id = newRef.key!;
    const exam: Exam = {
      id,
      title: newExamTitle,
      teacherId,
      createdAt: Date.now(),
      questions: questions,
      isActive: true
    };
    await set(ref(db, `exams/${teacherId}/${id}`), exam);
    setView('list');
    setNewExamTitle('');
    setQuestions([]);
  };

  // --- Taking Logic ---

  const submitExam = async () => {
    if (!selectedExam || !studentId) return;
    
    let autoScore = 0;
    selectedExam.questions.forEach(q => {
      if (q.type === 'multiple_choice' && answers[q.id] === q.correctAnswer) {
        autoScore += q.points;
      }
    });

    const submissionRef = push(ref(db, `submissions/${selectedExam.id}`));
    const submissionId = submissionRef.key!;
    const submission: ExamSubmission = {
      id: submissionId,
      examId: selectedExam.id,
      studentId,
      studentName: studentName || 'Unknown',
      answers,
      score: autoScore, 
      graded: false,
      submittedAt: Date.now()
    };

    await set(ref(db, `submissions/${selectedExam.id}/${studentId}`), submission);
    setView('list');
    alert('تم إرسال الإجابات بنجاح!');
  };

  // --- Grading Logic ---

  const openGrading = async (exam: Exam) => {
     setSelectedExam(exam);
     const subRef = ref(db, `submissions/${exam.id}`);
     const snapshot = await get(subRef);
     if (snapshot.exists()) {
         setSubmissions(Object.values(snapshot.val()));
     } else {
         setSubmissions([]);
     }
     setView('results');
  };

  const startGradingSubmission = (sub: ExamSubmission) => {
    setSelectedSubmission(sub);
    setGradingScore(sub.score || 0);
    setView('grading');
  };

  const finalizeGrade = async () => {
    if (!selectedSubmission || !selectedExam) return;
    await update(ref(db, `submissions/${selectedExam.id}/${selectedSubmission.studentId}`), {
        score: gradingScore,
        graded: true
    });
    alert("تم رصد الدرجة بنجاح");
    setView('results');
    openGrading(selectedExam); 
  };

  // --- RENDERERS ---

  // 1. CREATE EXAM
  if (view === 'create' && role === UserRole.TEACHER) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Edit3 size={24}/></div>
                إنشاء امتحان جديد
            </h2>
            <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 px-4">إلغاء</button>
        </div>
        
        <div className="mb-8">
             <input 
                className="w-full text-3xl font-bold border-b-2 border-gray-100 py-3 mb-2 focus:border-indigo-500 outline-none transition-colors placeholder-gray-300"
                placeholder="عنوان الامتحان هنا"
                value={newExamTitle}
                onChange={(e) => setNewExamTitle(e.target.value)}
            />
            <p className="text-sm text-gray-400">قم بإضافة الأسئلة أدناه. يمكنك المزج بين الأسئلة المقالية والاختيارات.</p>
        </div>

        {/* Question Builder */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden mb-8 shadow-inner">
          <div className="bg-gray-100/50 p-4 border-b border-gray-200 flex justify-between items-center">
             <span className="font-bold text-gray-600 flex items-center gap-2"><Plus size={16}/> إضافة سؤال</span>
             <div className="flex gap-2">
                  <select 
                    value={qType} onChange={(e) => setQType(e.target.value as any)}
                    className="p-2 border-none rounded-lg bg-white shadow-sm text-sm font-bold text-gray-700 focus:ring-0"
                  >
                    <option value="multiple_choice">اختيارات متعددة</option>
                    <option value="essay">سؤال مقالي</option>
                  </select>
                  <div className="flex items-center gap-2 bg-white px-2 rounded-lg shadow-sm">
                      <span className="text-xs text-gray-400 font-bold">درجات:</span>
                      <input 
                        type="number" value={qPoints} onChange={(e) => setQPoints(Number(e.target.value))}
                        className="w-12 p-1 text-center font-bold outline-none"
                      />
                  </div>
             </div>
          </div>
          
          <div className="p-6">
               <input 
                 value={qText} onChange={(e) => setQText(e.target.value)}
                 className="w-full p-4 border border-gray-200 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white" 
                 placeholder="اكتب نص السؤال هنا..."
               />

               {qType === 'multiple_choice' && (
                 <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-400 mb-2">خيارات الإجابة (حدد الصحيحة)</p>
                    {qOptions.map((opt, idx) => (
                        <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg border ${qCorrectIdx === idx ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}>
                            <input 
                            type="radio" name="correct_opt" 
                            checked={qCorrectIdx === idx} onChange={() => setQCorrectIdx(idx)}
                            className="w-5 h-5 text-green-600 accent-green-600 cursor-pointer"
                            />
                            <input 
                            value={opt} onChange={(e) => {
                                const newOpts = [...qOptions];
                                newOpts[idx] = e.target.value;
                                setQOptions(newOpts);
                            }}
                            placeholder={`الاختيار ${idx+1}`}
                            className="flex-1 bg-transparent outline-none text-sm font-medium"
                            />
                        </div>
                    ))}
                 </div>
               )}

               <button onClick={addQuestion} className="w-full mt-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition font-bold flex items-center justify-center gap-2">
                 <Plus size={18}/> إدراج السؤال في الامتحان
               </button>
          </div>
        </div>

        {/* Preview Questions */}
        <div className="space-y-4 mb-8">
          {questions.length > 0 && <h3 className="font-bold text-gray-700">معاينة الأسئلة ({questions.length})</h3>}
          {questions.map((q, idx) => (
            <div key={q.id} className="p-5 border border-gray-100 rounded-2xl bg-white shadow-sm relative group hover:border-indigo-100 transition">
              <button onClick={() => deleteQuestion(idx)} className="absolute left-4 top-4 text-gray-300 hover:text-red-500 transition">
                 <Trash2 size={18} />
              </button>
              <div className="flex items-start gap-3 mb-3">
                <span className="bg-indigo-600 text-white w-6 h-6 rounded flex items-center justify-center text-xs font-bold mt-1">{idx+1}</span>
                <div>
                    <p className="font-bold text-lg text-gray-800">{q.text}</p>
                    <span className="text-xs text-gray-400 font-mono">({q.points} درجات) • {q.type === 'multiple_choice' ? 'اختياري' : 'مقالي'}</span>
                </div>
              </div>
              {q.type === 'multiple_choice' && (
                <div className="grid grid-cols-2 gap-2 pr-9">
                  {q.options?.map((opt, i) => (
                    <div key={i} className={`px-3 py-2 rounded-lg text-sm border ${opt === q.correctAnswer ? "bg-green-50 border-green-100 text-green-700 font-bold" : "bg-gray-50 border-gray-50 text-gray-500"}`}>
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t pt-6">
            <button onClick={saveExam} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-1 transition font-bold flex items-center gap-2">
                <Save size={20}/> حفظ ونشر الامتحان
            </button>
        </div>
      </div>
    );
  }

  // 2. TAKE EXAM (STUDENT CBT MODE)
  if (view === 'take' && selectedExam) {
    return (
      <div className="bg-white min-h-[600px] rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
             <div>
                <h2 className="text-2xl font-bold">{selectedExam.title}</h2>
                <p className="text-slate-400 text-sm">يرجى الإجابة بدقة، لا يمكنك التعديل بعد التسليم.</p>
             </div>
             <div className="flex gap-4">
                 <div className="text-center">
                     <span className="block text-xs text-slate-500 uppercase">عدد الأسئلة</span>
                     <span className="font-mono text-xl font-bold">{selectedExam.questions.length}</span>
                 </div>
             </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
            <div className="max-w-3xl mx-auto space-y-12">
            {selectedExam.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative">
                    <span className="absolute -right-4 top-8 bg-indigo-600 text-white px-4 py-1 rounded-l-full font-bold shadow-md">سؤال {idx + 1}</span>
                    
                    <h3 className="font-bold text-xl text-gray-800 mt-6 mb-6 leading-relaxed">{q.text}</h3>
                    
                    {q.type === 'multiple_choice' ? (
                        <div className="space-y-3">
                        {q.options?.map((opt) => (
                            <label key={opt} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 border-2 ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${answers[q.id] === opt ? 'border-indigo-600' : 'border-gray-300'}`}>
                                {answers[q.id] === opt && <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>}
                            </div>
                            <input 
                                type="radio" name={q.id} value={opt} 
                                onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                                className="hidden"
                            />
                            <span className={`font-medium text-lg ${answers[q.id] === opt ? 'text-indigo-900' : 'text-gray-600'}`}>{opt}</span>
                            </label>
                        ))}
                        </div>
                    ) : (
                        <textarea 
                        className="w-full p-5 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:ring-0 outline-none h-40 transition bg-gray-50 focus:bg-white resize-none text-lg"
                        placeholder="اكتب إجابتك هنا بالتفصيل..."
                        onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                        ></textarea>
                    )}
                </div>
            ))}
            </div>
        </div>

        <div className="p-6 bg-white border-t border-gray-100 flex justify-center">
          <button onClick={submitExam} className="px-12 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition transform w-full md:w-auto">
            تسليم الامتحان وإنهاء
          </button>
        </div>
      </div>
    );
  }

  // 3. GRADING VIEW (TEACHER)
  if (view === 'grading' && selectedExam && selectedSubmission) {
      return (
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
            <div className="bg-gray-900 text-white p-8 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <button onClick={() => setView('results')} className="p-1 hover:bg-white/20 rounded-lg transition"><ArrowRight size={20}/></button>
                        <h2 className="text-2xl font-bold">تصحيح ورقة إجابة</h2>
                    </div>
                    <p className="text-gray-400 mr-10">{selectedSubmission.studentName} - {selectedExam.title}</p>
                </div>
                <div className="flex items-center gap-4 bg-white/10 p-2 rounded-2xl">
                    <div className="px-4">
                        <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold">الدرجة النهائية</span>
                        <input 
                            type="number" 
                            value={gradingScore} 
                            onChange={(e) => setGradingScore(Number(e.target.value))}
                            className="bg-transparent text-3xl font-bold text-green-400 w-24 outline-none text-center font-mono"
                        />
                    </div>
                    <button onClick={finalizeGrade} className="bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-green-900/20">
                        اعتماد الدرجة
                    </button>
                </div>
            </div>

            <div className="p-8 space-y-8 bg-gray-50/50 max-h-[70vh] overflow-y-auto">
                {selectedExam.questions.map((q, idx) => {
                    const studentAns = selectedSubmission.answers[q.id];
                    const isCorrect = q.type === 'multiple_choice' && studentAns === q.correctAnswer;

                    return (
                        <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                            <div className="flex justify-between mb-6 pb-4 border-b border-gray-50">
                                <h3 className="font-bold text-xl text-gray-800">س{idx+1}: {q.text}</h3>
                                <span className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-bold text-gray-600 h-fit">{q.points} درجات</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Student Answer */}
                                <div className={`p-6 rounded-2xl border-2 relative overflow-hidden ${isCorrect ? 'bg-green-50/50 border-green-200' : q.type === 'multiple_choice' ? 'bg-red-50/50 border-red-200' : 'bg-blue-50/50 border-blue-200'}`}>
                                    <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl text-xs font-bold uppercase tracking-wider bg-white/50 backdrop-blur">إجابة الطالب</div>
                                    <p className="font-bold text-lg text-gray-800 mt-4 leading-relaxed">{studentAns || <span className="text-gray-400 italic font-normal">لم يجب الطالب</span>}</p>
                                    {q.type === 'multiple_choice' && (
                                        <div className={`absolute bottom-4 left-4 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                            {isCorrect ? <CheckCircle size={24}/> : <X size={24}/>}
                                        </div>
                                    )}
                                </div>

                                {/* Model Answer */}
                                <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50 relative">
                                    <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl text-xs font-bold uppercase tracking-wider bg-gray-200 text-gray-600">النموذج</div>
                                    {q.type === 'multiple_choice' ? (
                                        <p className="font-bold text-lg text-green-700 mt-4">{q.correctAnswer}</p>
                                    ) : (
                                        <div className="mt-4">
                                            <p className="text-gray-500 text-sm italic mb-2">سؤال مقالي - تقدير المعلم:</p>
                                            <p className="text-gray-800">يرجى مراجعة الإجابة وتقدير الدرجة المناسبة.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
      )
  }

  // 4. SUBMISSIONS LIST (TEACHER)
  if (view === 'results' && selectedExam && role === UserRole.TEACHER) {
      return (
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100 min-h-[600px]">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">نتائج الطلاب</h2>
                    <p className="text-gray-400 font-medium mt-1">{selectedExam.title}</p>
                </div>
                <button onClick={() => setView('list')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2">
                    <ArrowRight size={18}/> عودة
                </button>
            </div>
            <div className="grid gap-4">
                {submissions.length === 0 && (
                    <div className="text-center py-24 text-gray-300 flex flex-col items-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <List size={32} />
                        </div>
                        <p className="text-lg font-medium">لا توجد تسليمات حتى الآن</p>
                    </div>
                )}
                {submissions.map(sub => (
                    <div key={sub.id} className="group border border-gray-100 p-5 rounded-2xl flex justify-between items-center hover:border-indigo-200 hover:shadow-lg transition-all duration-300 bg-white">
                        <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${sub.graded ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {sub.score}
                            </div>
                            <div>
                                <p className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition">{sub.studentName}</p>
                                <p className="text-xs text-gray-400 flex items-center gap-1 font-mono mt-1">
                                    <Clock size={12}/> {new Date(sub.submittedAt).toLocaleDateString('ar-EG')} {new Date(sub.submittedAt).toLocaleTimeString('ar-EG')}
                                </p>
                            </div>
                        </div>
                        
                        {sub.graded ? (
                            <button 
                                onClick={() => startGradingSubmission(sub)}
                                className="text-emerald-600 px-5 py-2.5 rounded-xl hover:bg-emerald-50 transition flex items-center gap-2 font-bold text-sm border border-transparent hover:border-emerald-100"
                            >
                                <CheckCircle size={18}/> تم التصحيح
                            </button>
                        ) : (
                            <button 
                                onClick={() => startGradingSubmission(sub)}
                                className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg shadow-slate-200 hover:bg-black transition font-bold text-sm transform active:scale-95"
                            >
                                تصحيح الآن
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
      )
  }

  // 5. EXAM LIST (DEFAULT)
  return (
    <div className="space-y-8">
      {role === UserRole.TEACHER && (
        <div className="flex justify-end">
             <button 
                onClick={() => setView('create')}
                className="bg-slate-900 text-white px-6 py-3 rounded-2xl hover:bg-black transition flex items-center gap-3 shadow-lg shadow-slate-500/20 font-bold transform active:scale-95"
                >
                <Plus size={20} /> إضافة امتحان جديد
            </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {exams.map(exam => (
          <div key={exam.id} className="group bg-white rounded-[2rem] shadow-sm hover:shadow-2xl border border-gray-100 hover:border-indigo-100 overflow-hidden transition-all duration-300 relative">
            {/* Card Header / Cover */}
            <div className="h-32 bg-gradient-to-br from-indigo-600 to-purple-700 p-6 flex flex-col justify-between text-white relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                 <div className="relative z-10">
                    <span className="bg-white/20 backdrop-blur-md text-xs font-bold px-3 py-1 rounded-full border border-white/10">{exam.questions.length} أسئلة</span>
                 </div>
                 <div className="relative z-10 flex justify-between items-end">
                     <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><FileText size={24}/></div>
                     <span className="text-indigo-200 text-xs font-mono opacity-80">{new Date(exam.createdAt).toLocaleDateString('ar-EG')}</span>
                 </div>
            </div>

            <div className="p-6">
                <h3 className="font-bold text-xl mb-2 text-gray-900 leading-tight group-hover:text-indigo-600 transition">{exam.title}</h3>
                
                <div className="mt-6">
                    {role === UserRole.TEACHER ? (
                        <button onClick={() => openGrading(exam)} className="w-full py-3 rounded-xl font-bold text-sm border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition flex items-center justify-center gap-2">
                            النتائج والدرجات <ChevronDown size={16}/>
                        </button>
                    ) : (
                        studentSubmissions[exam.id] ? (
                            <div className={`p-4 rounded-2xl text-center border ${studentSubmissions[exam.id].graded ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                {studentSubmissions[exam.id].graded ? (
                                <div className="text-emerald-700 font-bold flex flex-col items-center">
                                    <span className="text-4xl mb-1">{studentSubmissions[exam.id].score}</span>
                                    <span className="text-[10px] uppercase tracking-widest opacity-75">الدرجة النهائية</span>
                                </div>
                                ) : (
                                <div className="text-amber-700 font-medium flex flex-col items-center gap-2 py-2">
                                    <Clock size={24} className="opacity-50 animate-pulse"/>
                                    <span className="text-sm">جاري التصحيح...</span>
                                </div>
                                )}
                            </div>
                        ) : (
                            <button 
                                onClick={() => { setSelectedExam(exam); setView('take'); }}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-black transition flex items-center justify-center gap-2 transform active:scale-95"
                            >
                                ابدأ الامتحان <ArrowRight size={18}/>
                            </button>
                        )
                    )}
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Exams;