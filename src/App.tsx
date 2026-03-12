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
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    studentId: '',
    phone: ''
  });

  // Get reference from URL
  const ref = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  }, []);

  useEffect(() => {
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
  }, [ref]);

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
        // or we can show a "Processing" state here.
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
      <div className="min-h-screen bg-[#F2F4F6] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-[#0088CC] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Fetching booking details...</p>
      </div>
    );
  }

  if (errorMessage && !booking) {
    return (
      <div className="min-h-screen bg-[#F2F4F6] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-[#0088CC] text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F6] font-sans text-gray-900 pb-12">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#0088CC] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs">U</span>
          </div>
          <h1 className="text-[#0088CC] font-black text-xl tracking-tight">UPSA</h1>
        </div>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Campus App
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 pt-8">
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center border border-emerald-50"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Successful!</h2>
              <p className="text-gray-500 mb-6">Your room has been secured. You can now return to the app.</p>
              
              <div className="bg-gray-50 p-4 rounded-2xl mb-8">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Receipt Reference</p>
                <p className="font-mono text-lg font-bold text-[#0088CC]">{ref}</p>
              </div>

              <button 
                onClick={() => window.close()}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                Return to App
              </button>
            </motion.div>
          ) : status === 'error' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center border border-red-50"
            >
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Failed</h2>
              <p className="text-gray-500 mb-8">{errorMessage || 'Something went wrong with the transaction.'}</p>
              
              <button 
                onClick={() => setStatus('idle')}
                className="w-full bg-[#0088CC] text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
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
                className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100"
              >
                <div className="bg-[#0088CC] p-6 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Booking Reference</p>
                      <h3 className="text-xl font-black tracking-tight">{ref}</h3>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{timeLeft}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-6">
                    <div className="flex-1">
                      <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Amount Due</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold">GHS</span>
                        <span className="text-4xl font-black">{booking?.amount || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Building2 className="w-4 h-4 text-[#0088CC]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Hostel</p>
                        <p className="text-sm font-bold">{booking?.hostel || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Bed className="w-4 h-4 text-[#0088CC]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Room/Bed</p>
                        <p className="text-sm font-bold">{booking?.room || 'N/A'} - {booking?.bed || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase">Room Type</span>
                    <span className="text-xs font-black bg-gray-100 px-2 py-1 rounded-md">{booking?.room_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase">Gender</span>
                    <span className="text-xs font-black bg-gray-100 px-2 py-1 rounded-md capitalize">{booking?.gender || 'N/A'}</span>
                  </div>
                </div>
              </motion.section>

              {/* Student Form */}
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100"
              >
                <h4 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0088CC]" />
                  Student Details
                </h4>
                
                <form onSubmit={handlePayment} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input 
                        type="text"
                        required
                        placeholder="As on Student ID"
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#0088CC]/20 transition-all outline-none"
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Student ID / Index No.</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input 
                        type="text"
                        required
                        placeholder="10XXXXXX"
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#0088CC]/20 transition-all outline-none"
                        value={formData.studentId}
                        onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">MoMo Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input 
                        type="tel"
                        required
                        placeholder="024XXXXXXX"
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#0088CC]/20 transition-all outline-none"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-[#0088CC] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 mt-8"
                  >
                    {status === 'loading' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        Pay GHS {booking?.amount} with Zeepay
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </motion.section>

              <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest px-8 leading-relaxed">
                Secure payment powered by Zeepay. By clicking pay, you agree to the hostel terms and conditions.
              </p>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
