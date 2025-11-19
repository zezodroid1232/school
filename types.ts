export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export interface TeacherProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  chatLocked: boolean;
}

export type PaymentStatus = 'paid' | 'unpaid' | 'warned' | 'locked';

export interface PaymentRecord {
  id: string;
  date: string; // ISO Date
  timestamp: number;
  adminName: string;
  status: 'paid';
}

export interface StudentProfile {
  id: string;
  name: string;
  teacherId: string;
  code: string; // Activation code
  hasPaid: boolean; // Keep for backward compatibility
  paymentStatus?: PaymentStatus;
  paymentHistory?: Record<string, PaymentRecord>;
  reviewRequested?: boolean; // If student clicked "I paid" while locked
  rating: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  timestamp: number;
  isAdmin: boolean;
}

export interface Exam {
  id: string;
  title: string;
  teacherId: string;
  createdAt: number;
  questions: Question[];
  isActive: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple_choice' | 'essay';
  options?: string[];
  correctAnswer?: string; // For auto-grading MCQ
  points: number;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string>; // questionId -> answer
  score?: number;
  graded: boolean;
  submittedAt: number;
  feedback?: string;
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
}