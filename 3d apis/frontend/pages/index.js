import Link from 'next/link';
import { useEffect, useRef } from 'react';

export default function Home() {
  const sketchfabRef = useRef(null);

  useEffect(() => {
    document.body.style.background = 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
    return () => { document.body.style.background = ''; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Full background Sketchfab model */}
      <div className="fixed inset-0 -z-10 w-full h-full">
        <iframe
          ref={sketchfabRef}
          title="3D Fashion Model"
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          src="https://sketchfab.com/models/fb3c7c912757417880a2924da3df1901/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0&dnt=1"
          className="sketchfab-bg"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/40 to-white/10 pointer-events-none" />
      </div>
      <div className="flex flex-col items-center justify-center w-full h-full z-10 min-h-60vh">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-purple-700 animate-pulse drop-shadow-2xl text-center">Virtual Dressing Room</h1>
        <p className="mb-10 text-lg md:text-xl text-gray-800 text-center max-w-2xl animate-fade-in font-medium shadow-sm bg-white/60 rounded-xl px-6 py-4">Create your personalized 3D avatar, explore a wardrobe of digital outfits, and try them on in a stunning 3D environment.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 animate-fade-in w-full">
          <Link href="/login" className="btn-landing bg-gradient-to-r from-blue-500 to-blue-700 text-white px-16 py-6 rounded-3xl shadow-2xl hover:scale-110 hover:from-blue-600 hover:to-blue-800 transition-all text-3xl font-extrabold border-4 border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-300 mb-4 sm:mb-0">Login</Link>
          <Link href="/register" className="btn-landing bg-gradient-to-r from-green-500 to-green-700 text-white px-16 py-6 rounded-3xl shadow-2xl hover:scale-110 hover:from-green-600 hover:to-green-800 transition-all text-3xl font-extrabold border-4 border-green-200 focus:outline-none focus:ring-4 focus:ring-green-300">Register</Link>
        </div>
      </div>
      <footer className="mt-16 text-gray-400 text-sm z-10 text-center">&copy; {new Date().getFullYear()} Virtual Dressing Room</footer>
    </div>
  );
}
