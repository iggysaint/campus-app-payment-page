/**
 * UPSA Campus App — Hostel Payment Page
 */

import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
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
  Bed,
  LayersIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

type PaymentStatus = 'idle' | 'loading' | 'processing' | 'success' | 'error';

export default function App() {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    studentId: '',
    phone: '',
  });

  // Get ?ref= from URL
  const ref = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  }, []);

  // ── Firestore: query by reference field (not doc ID) ──────────────────────
  useEffect(() => {
    if (!db || !ref) {
      setLoading(false);
      if (!ref) setErrorMessage('No booking reference provided.');
      return;
    }

    // FIX: query where reference == ref, not by doc ID
    const q = query(
      collection(db, 'bookings'),
      where('reference', '==', ref)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setBooking(data);

        // Auto-show success when webhook fires and Firestore updates
        if (data.payment_status === 'paid' || data.status === 'confirmed') {
          setStatus('success');
        }
      } else {
        setErrorMessage('Booking reference not found. Please check and try again.');
      }
      setLoading(false);
    }, (error) => {
      console.error('Firestore error:', error);
      setErrorMessage('Failed to connect to booking service.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ref]);

  // ── Expiry countdown timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!booking?.expires_at) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Handle both Firestore Timestamp and plain JS Date
      const expiry = booking.expires_at?.toDate
        ? booking.expires_at.toDate().getTime()
        : new Date(booking.expires_at).getTime();

      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m`);
        } else {
          setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [booking]);

  // ── Payment handler ────────────────────────────────────────────────────────
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
          name: formData.fullName,
          studentId: formData.studentId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Show processing state — wait for Firestore onSnapshot to fire success
        setStatus('processing');
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Payment initiation failed.');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('A network error occurred. Please try again.');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F4F6] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-[#0088CC] animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Fetching booking details...</p>
      </div>
    );
  }

  // ── Error — no booking found ───────────────────────────────────────────────
  if (errorMessage && !booking) {
    return (
      <div className="min-h-screen bg-[#F2F4F6] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[#0088CC] text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
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
          Hostel Payment
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 pt-8">
        <AnimatePresence mode="wait">

          {/* ── Success ── */}
          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center border border-emerald-50"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Successful!</h2>
              <p className="text-gray-500 mb-6">
                Your room has been confirmed. Return to the app to view your booking.
              </p>
              <div className="bg-gray-50 p-4 rounded-2xl mb-8">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Booking Reference</p>
                <p className="font-mono text-lg font-bold text-[#0088CC]">{ref}</p>
              </div>
              <button
                onClick={() => window.close()}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                Return to App
              </button>
            </motion.div>
          )}

          {/* ── Processing ── */}
          {status === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center"
            >
              <Loader2 className="w-16 h-16 text-[#0088CC] animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-black text-gray-900 mb-2">Processing Payment</h2>
              <p className="text-gray-500">
                Please complete the MoMo prompt on your phone. This page will update automatically.
              </p>
            </motion.div>
          )}

          {/* ── Error ── */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center border border-red-50"
            >
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Failed</h2>
              <p className="text-gray-500 mb-8">
                {errorMessage || 'Something went wrong with the transaction.'}
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="w-full bg-[#0088CC] text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform"
              >
                Retry Payment
              </button>
            </motion.div>
          )}

          {/* ── Main form ── */}
          {(status === 'idle' || status === 'loading') && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >

              {/* Expired banner */}
              {isExpired && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-700">
                    This booking has expired. Please make a new booking in the app.
                  </p>
                </div>
              )}

              {/* Booking Summary Card */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100"
              >
                {/* Blue header */}
                <div className="bg-[#0088CC] p-6 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">
                        Booking Reference
                      </p>
                      <h3 className="text-xl font-black tracking-tight font-mono">{ref}</h3>
                    </div>
                    {/* Countdown timer */}
                    <div className={`backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                      isExpired ? 'bg-red-500/40' : 'bg-white/20'
                    }`}>
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{timeLeft || '...'}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">
                      Amount Due
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold">GHS</span>
                      <span className="text-4xl font-black">{booking?.amount ?? '0'}</span>
                    </div>
                  </div>
                </div>

                {/* Booking details */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Building2 className="w-4 h-4 text-[#0088CC]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Hostel</p>
                        {/* FIX: correct field name hostel_name */}
                        <p className="text-sm font-bold">{booking?.hostel_name ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <LayersIcon className="w-4 h-4 text-[#0088CC]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Floor</p>
                        {/* FIX: correct field name floor_number */}
                        <p className="text-sm font-bold">Floor {booking?.floor_number ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Bed className="w-4 h-4 text-[#0088CC]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Room / Bed</p>
                        {/* FIX: correct field names room_number + bed_number */}
                        <p className="text-sm font-bold">
                          {booking?.room_number ?? 'N/A'} · Bed {booking?.bed_number ?? 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <CreditCard className="w-4 h-4 text-[#0088CC]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Room Type</p>
                        {/* FIX: correct field name room_type */}
                        <p className="text-sm font-bold">{booking?.room_type ?? 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase">Gender</span>
                    <span className="text-xs font-black bg-gray-100 px-3 py-1 rounded-full capitalize">
                      {booking?.gender ?? 'N/A'}
                    </span>
                  </div>

                  {/* Payment status badge */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase">Payment Status</span>
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${
                      booking?.payment_status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : booking?.payment_status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                    }`}>
                      {booking?.payment_status === 'paid' ? 'Paid' :
                       booking?.payment_status === 'failed' ? 'Failed' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </motion.section>

              {/* Student Details Form */}
              {!isExpired && (
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
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input
                          type="text"
                          required
                          placeholder="As on Student ID"
                          className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#0088CC]/20 transition-all outline-none"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                        Student ID / Index No.
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input
                          type="text"
                          required
                          placeholder="10XXXXXX"
                          className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#0088CC]/20 transition-all outline-none"
                          value={formData.studentId}
                          onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                        MoMo Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input
                          type="tel"
                          required
                          placeholder="024XXXXXXX"
                          className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#0088CC]/20 transition-all outline-none"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'loading' || isExpired}
                      className="w-full bg-[#0088CC] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 mt-6"
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
              )}

              <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest px-8 leading-relaxed">
                Secure payment powered by Zeepay · UPSA Campus App
              </p>

            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
