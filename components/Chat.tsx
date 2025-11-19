import React, { useState, useEffect, useRef } from 'react';
import { db, uploadFile, ref, onValue, push, update, query, limitToLast } from '../services/firebase';
import { Message, UserRole } from '../types';
import { Send, Mic, Paperclip, Lock, Unlock, Video, StopCircle, Trash2, Loader } from 'lucide-react';

interface ChatProps {
  teacherId: string;
  currentUserId: string;
  currentUserName: string;
  role: UserRole;
}

const Chat: React.FC<ChatProps> = ({ teacherId, currentUserId, currentUserName, role }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Listen to Messages (Optimized: Limit to last 100)
  useEffect(() => {
    const messagesRef = query(ref(db, `chats/${teacherId}/messages`), limitToLast(100));
    const unsubscribe = onValue(messagesRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const parsedMessages = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => a.timestamp - b.timestamp);
        setMessages(parsedMessages);
      } else {
        setMessages([]);
      }
    });

    // Listen to Lock Status
    const lockRef = ref(db, `teachers/${teacherId}/chatLocked`);
    const lockUnsub = onValue(lockRef, (snapshot: any) => {
      setIsLocked(!!snapshot.val());
    });

    return () => {
      unsubscribe();
      lockUnsub();
    };
  }, [teacherId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (type: Message['type'] = 'text', content: string = '', file?: File) => {
    if (isLocked && role === UserRole.STUDENT) return;

    let mediaUrl = '';
    if (file) {
      setUploading(true);
      try {
        mediaUrl = await uploadFile(file, `chat/${teacherId}/${Date.now()}_${file.name}`);
      } catch (e) {
        console.error(e);
        setUploading(false);
        alert("فشل رفع الملف");
        return;
      }
      setUploading(false);
    }

    const newMessage: any = {
      senderId: currentUserId,
      senderName: currentUserName,
      type,
      timestamp: Date.now(),
      isAdmin: role === UserRole.TEACHER
    };

    if (type === 'text' && content) newMessage.text = content;
    if (mediaUrl) newMessage.mediaUrl = mediaUrl;

    try {
      await push(ref(db, `chats/${teacherId}/messages`), newMessage);
      setInputText('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
      sendMessage(type, '', file);
    }
  };

  const startRecording = async () => {
    if (isLocked && role === UserRole.STUDENT) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'; // Safari
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Convert to file
        const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([audioBlob], `voice_message.${fileExt}`, { type: mimeType });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
            await sendMessage('audio', '', file);
        }
        setRecordingDuration(0);
      };

      // Request data every 200ms to ensure we have data even in short clips
      mediaRecorder.start(200); 
      setIsRecording(true);
      
      // Start Timer
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("لا يمكن الوصول للميكروفون. يرجى التأكد من السماح للصلاحيات.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleLock = async () => {
    if (role !== UserRole.TEACHER) return;
    await update(ref(db, `teachers/${teacherId}`), { chatLocked: !isLocked });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative">
      {/* Header */}
      <div className="bg-white p-4 border-b flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isLocked ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {isLocked ? <Lock size={20}/> : <Unlock size={20}/>}
            </div>
            <div>
                <h2 className="font-bold text-gray-800 text-lg">غرفة المناقشة</h2>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                    {isLocked ? <span className="text-red-500 font-bold">المحادثة مغلقة</span> : <span className="text-emerald-600 font-bold">متاح للكتابة</span>}
                </p>
            </div>
        </div>
        {role === UserRole.TEACHER && (
          <button 
            onClick={toggleLock}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${isLocked ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {isLocked ? 'فتح المحادثة' : 'إغلاق المحادثة'}
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#e5e5e5] relative bg-opacity-30">
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{backgroundImage: 'radial-gradient(#4F46E5 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
        
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] md:max-w-[65%] relative group ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                 {!isMe && (
                     <span className="text-[10px] font-bold text-gray-500 mb-1 mr-2 flex items-center gap-1 px-1">
                        {msg.senderName} {msg.isAdmin && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[9px] border border-indigo-200">معلم</span>}
                     </span>
                 )}
                 
                 <div className={`p-3 md:p-4 shadow-sm ${
                    isMe 
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tl-none shadow-indigo-200' 
                    : 'bg-white text-gray-800 rounded-2xl rounded-tr-none shadow-gray-200'
                 }`}>
                    {msg.type === 'text' && <p className="text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>}
                    
                    {msg.type === 'image' && (
                        <div className="rounded-xl overflow-hidden mb-1 bg-black/5">
                            <img src={msg.mediaUrl} alt="img" loading="lazy" className="max-h-60 w-full object-cover cursor-pointer hover:opacity-95 transition" onClick={() => window.open(msg.mediaUrl)} />
                        </div>
                    )}
                    
                    {msg.type === 'audio' && (
                        <div className="flex items-center gap-3 min-w-[240px]">
                             <div className={`p-2.5 rounded-full ${isMe ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                                <Mic size={18}/>
                             </div>
                             <audio controls src={msg.mediaUrl} className="h-8 w-full accent-indigo-500" controlsList="nodownload" />
                        </div>
                    )}

                    {msg.type === 'file' && (
                        <a href={msg.mediaUrl} target="_blank" className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-50 hover:bg-gray-100'} transition group/file`}>
                            <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                                <Paperclip size={20}/>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-xs opacity-70">ملف مرفق</span>
                                <span className="underline decoration-dotted text-sm">تحميل الملف</span>
                            </div>
                        </a>
                    )}

                    <span className={`text-[10px] block text-right mt-1.5 font-mono opacity-70`}>
                        {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                 </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20">
         {isLocked && role === UserRole.STUDENT ? (
             <div className="flex flex-col items-center justify-center py-6 text-gray-400 gap-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                 <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Lock size={24} className="text-gray-300"/>
                 </div>
                 <span className="font-bold text-sm">قام المعلم بإيقاف المحادثة مؤقتاً</span>
             </div>
         ) : (
            <div className="flex items-end gap-2 md:gap-3">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                
                {/* Recording UI Overlay */}
                {isRecording ? (
                    <div className="flex-1 bg-red-50 border border-red-100 rounded-[1.5rem] px-4 py-3 flex items-center justify-between animate-in fade-in duration-200">
                        <div className="flex items-center gap-3 text-red-600">
                            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                            <span className="font-mono font-bold text-lg">{formatTime(recordingDuration)}</span>
                            <span className="text-sm font-medium">جاري التسجيل...</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => { stopRecording(); setRecordingDuration(0); }} className="p-2 bg-white text-red-500 rounded-full shadow-sm hover:bg-red-500 hover:text-white transition">
                                <Trash2 size={20} />
                             </button>
                             <button onClick={stopRecording} className="p-2 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition animate-pulse">
                                <Send size={20} className="ml-0.5"/>
                             </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-1 bg-gray-50 p-1.5 rounded-full border border-gray-200 shadow-inner">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-gray-500 hover:bg-white hover:text-indigo-600 rounded-full transition hover:shadow-md" disabled={uploading} title="إرفاق ملف">
                                <Paperclip size={20} />
                            </button>
                            <button 
                                onClick={startRecording}
                                className="p-2.5 text-gray-500 hover:bg-white hover:text-red-500 rounded-full transition hover:shadow-md"
                                disabled={uploading}
                                title="تسجيل صوتي"
                            >
                                <Mic size={20} />
                            </button>
                        </div>

                        <div className="flex-1 relative">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage('text', inputText); }}}
                                placeholder="اكتب رسالتك هنا..."
                                className="w-full bg-gray-50 border-gray-200 rounded-[1.5rem] px-5 py-3.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition resize-none max-h-32 min-h-[54px] outline-none text-gray-700 placeholder-gray-400 shadow-inner"
                                rows={1}
                            />
                        </div>

                        <button 
                            onClick={() => inputText.trim() && sendMessage('text', inputText)}
                            className="p-3.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transform active:scale-95 flex-shrink-0"
                            disabled={!inputText.trim() && !uploading}
                        >
                            {uploading ? <Loader size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5 mt-0.5" />}
                        </button>
                    </>
                )}
            </div>
         )}
      </div>
    </div>
  );
};

export default Chat;