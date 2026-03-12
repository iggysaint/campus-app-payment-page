/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clock, 
  User, 
  Hash, 
  Phone,
  ChevronRight,
  Building2,
  Bed
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if config is provided
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

type PaymentStatus = 'idle' | 'loading' | 'success' | 'error';

export default function App() {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  // Zeepay Red: #E31B23
  const primaryColor = '#E31B23';

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    studentId: '',
    phone: ''
  });

  // Get reference from URL
  const { ref, isDemo } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      ref: params.get('ref'),
      isDemo: params.get('demo') === 'true' || !firebaseConfig.apiKey
    };
  }, []);

  useEffect(() => {
    if (isDemo) {
      // Load mock data for demo mode
      setTimeout(() => {
        setBooking({
          hostel: 'Alpha Hostel',
          room: 'A12',
          bed: 'B',
          room_type: '2-in-room',
          gender: 'male',
          amount: '1500.00',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins from now
        });
        setLoading(false);
      }, 1000);
      return;
    }

    if (!db || !ref) {
      setLoading(false);
      if (!ref) setErrorMessage('No booking reference provided.');
      return;
    }

    const docRef = doc(db, 'bookings', ref);
    
    // Use onSnapshot for real-time updates (e.g. when payment is confirmed via webhook)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBooking(data);
        
        // If status changes to paid in Firestore, show success
        if (data.payment_status === 'paid' || data.status === 'confirmed') {
          setStatus('success');
        }
      } else {
        setErrorMessage('Booking reference not found.');
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setErrorMessage('Failed to connect to booking service.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ref, isDemo]);

  // Expiry timer logic
  useEffect(() => {
    if (!booking?.expires_at) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(booking.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        clearInterval(interval);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [booking]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.studentId || !formData.phone) {
      alert('Please fill in all details');
      return;
    }

    setStatus('loading');
    
    if (isDemo) {
      setTimeout(() => {
        setStatus('success');
      }, 2000);
      return;
    }
    
    try {
      const response = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          amount: booking.amount,
          phone: formData.phone,
          name: formData.fullName
        })
      });

      const result = await response.json();
      if (result.success) {
        // We wait for the Firestore onSnapshot to trigger the success state
        console.log("Payment initiated successfully");
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Payment initiation failed.');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('A network error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-[#E31B23] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Fetching booking details...</p>
      </div>
    );
  }

  if (errorMessage && !booking) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-[#E31B23] text-white py-4 rounded-xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-gray-900 pb-12 relative overflow-hidden">
      {/* Immersive Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-[#E31B23]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-[#FFD700]/5 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] left-[-20%] w-[40vw] h-[40vw] bg-[#E31B23]/3 rounded-full blur-[80px]" />
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E31B23] rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <span className="text-white font-black text-xl italic">Z</span>
          </div>
          <div>
            <h1 className="text-[#E31B23] font-black text-lg leading-none tracking-tight">ZEEPAY</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Hostel Payments</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="bg-[#FFD700] text-gray-900 px-3 py-1 rounded-full text-[10px] font-black tracking-tighter shadow-sm">
            USSD: *270#
          </div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            UPSA Campus
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 pt-8 relative z-10">
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center border border-emerald-50"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Successful!</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">Your room has been secured. You can now return to the app.</p>
              
              <div className="bg-gray-50 p-5 rounded-3xl mb-8">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Receipt Reference</p>
                <p className="font-mono text-xl font-bold text-[#E31B23]">{ref || 'DEMO-REF-123'}</p>
              </div>

              <button 
                onClick={() => window.close()}
                className="w-full bg-gray-900 text-white py-5 rounded-[1.5rem] font-bold active:scale-95 transition-transform shadow-xl shadow-gray-200"
              >
                Return to App
              </button>
            </motion.div>
          ) : status === 'error' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center border border-red-50"
            >
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Failed</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">{errorMessage || 'Something went wrong with the transaction.'}</p>
              
              <button 
                onClick={() => setStatus('idle')}
                className="w-full bg-[#E31B23] text-white py-5 rounded-[1.5rem] font-bold shadow-xl shadow-red-500/20 active:scale-95 transition-transform"
              >
                Retry Payment
              </button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Booking Summary Card */}
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100"
              >
                <div className="bg-[#E31B23] p-8 text-white relative overflow-hidden">
                  {/* Subtle pattern overlay */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mb-1">Booking Reference</p>
                        <h3 className="text-2xl font-black tracking-tight">{ref || 'DEMO-REF-123'}</h3>
                      </div>
                      <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/10">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{timeLeft}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mb-1">Amount Due</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-bold opacity-80">GHS</span>
                          <span className="text-5xl font-black">{booking?.amount || '0.00'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-5">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-red-50 rounded-2xl">
                        <Building2 className="w-5 h-5 text-[#E31B23]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hostel</p>
                        <p className="text-sm font-black text-gray-800">{booking?.hostel || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-red-50 rounded-2xl">
                        <Bed className="w-5 h-5 text-[#E31B23]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Room/Bed</p>
                        <p className="text-sm font-black text-gray-800">{booking?.room || 'N/A'} - {booking?.bed || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-5 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Room Type</span>
                    <span className="text-xs font-black bg-gray-50 text-gray-700 px-3 py-1.5 rounded-xl border border-gray-100">{booking?.room_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gender</span>
                    <span className="text-xs font-black bg-gray-50 text-gray-700 px-3 py-1.5 rounded-xl border border-gray-100 capitalize">{booking?.gender || 'N/A'}</span>
                  </div>
                </div>
              </motion.section>

              {/* Student Form */}
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-gray-100"
              >
                <h4 className="text-sm font-black text-gray-900 mb-8 flex items-center gap-2.5">
                  <div className="w-1.5 h-6 bg-[#E31B23] rounded-full" />
                  Student Details
                </h4>
                
                <form onSubmit={handlePayment} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#E31B23] transition-colors" />
                      <input 
                        type="text"
                        required
                        placeholder="As on Student ID"
                        className="w-full bg-gray-50 border-2 border-transparent rounded-[1.25rem] py-5 pl-14 pr-5 text-sm font-bold focus:bg-white focus:border-[#E31B23]/10 focus:ring-4 focus:ring-[#E31B23]/5 transition-all outline-none"
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Student ID / Index No.</label>
                    <div className="relative group">
                      <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#E31B23] transition-colors" />
                      <input 
                        type="text"
                        required
                        placeholder="10XXXXXX"
                        className="w-full bg-gray-50 border-2 border-transparent rounded-[1.25rem] py-5 pl-14 pr-5 text-sm font-bold focus:bg-white focus:border-[#E31B23]/10 focus:ring-4 focus:ring-[#E31B23]/5 transition-all outline-none"
                        value={formData.studentId}
                        onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 tracking-widest">MoMo Phone Number</label>
                    <div className="relative group">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#E31B23] transition-colors" />
                      <input 
                        type="tel"
                        required
                        placeholder="024XXXXXXX"
                        className="w-full bg-gray-50 border-2 border-transparent rounded-[1.25rem] py-5 pl-14 pr-5 text-sm font-bold focus:bg-white focus:border-[#E31B23]/10 focus:ring-4 focus:ring-[#E31B23]/5 transition-all outline-none"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-[#E31B23] text-white py-6 rounded-[1.5rem] font-black text-lg shadow-2xl shadow-red-500/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 mt-10"
                  >
                    {status === 'loading' ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : (
                      <>
                        Pay GHS {booking?.amount} with Zeepay
                        <ChevronRight className="w-6 h-6" />
                      </>
                    )}
                  </button>
                </form>
              </motion.section>

              <div className="flex flex-col items-center gap-4 px-8">
                <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
                  Secure payment powered by Zeepay
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-gray-300 rounded-full" />
                  <div className="w-1 h-1 bg-gray-300 rounded-full" />
                  <div className="w-1 h-1 bg-gray-300 rounded-full" />
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
