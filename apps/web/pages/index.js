import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-4">Virtual Try-On Avatar Platform</h1>
      <Link href="/upload">
        <button className="px-6 py-2 bg-blue-600 text-white rounded shadow">Get Started</button>
      </Link>
    </main>
  );
}
